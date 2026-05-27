using System.Text.Json;
using Api.Models;
using Confluent.Kafka;
using Microsoft.Extensions.Options;

namespace Api.Services;

public class KafkaOptions
{
    public string BootstrapServers { get; set; } = "";
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
    public string GroupId { get; set; } = "";
    public string Topic { get; set; } = "";
}

public class KafkaConsumerService : BackgroundService
{
    private readonly KafkaOptions _opts;
    private readonly TrainRegistry _registry;
    private readonly TiplocRepository _tiplocs;
    private readonly ILogger<KafkaConsumerService> _logger;

    private readonly Dictionary<string, string> _headcodeByRid = new();

    public KafkaConsumerService(
        IOptions<KafkaOptions> opts,
        TrainRegistry registry,
        TiplocRepository tiplocs,
        ILogger<KafkaConsumerService> logger)
    {
        _opts = opts.Value;
        _registry = registry;
        _tiplocs = tiplocs;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var config = new ConsumerConfig
        {
            BootstrapServers = _opts.BootstrapServers,
            SaslMechanism = SaslMechanism.Plain,
            SecurityProtocol = SecurityProtocol.SaslSsl,
            SaslUsername = _opts.Username,
            SaslPassword = _opts.Password,
            GroupId = _opts.GroupId,
            AutoOffsetReset = AutoOffsetReset.Latest,
            EnableAutoCommit = true,
        };

        using var consumer = new ConsumerBuilder<Ignore, string>(config).Build();
        consumer.Subscribe(_opts.Topic);

        _logger.LogInformation("Darwin consumer started, topic: {Topic}", _opts.Topic);

        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var result = consumer.Consume(stoppingToken);
                    if (result?.Message?.Value is null) continue;
                    ProcessMessage(result.Message.Value);
                }
                catch (ConsumeException ex)
                {
                    _logger.LogError(ex, "Darwin Kafka consume error");
                    await Task.Delay(1000, stoppingToken);
                }
            }
        }
        catch (OperationCanceledException) { }
        finally
        {
            consumer.Close();
        }
    }

    private int _rawCount;

    private void ProcessMessage(string json)
    {
        if (Interlocked.Increment(ref _rawCount) <= 3)
            _logger.LogInformation("Darwin raw sample: {Json}", json[..Math.Min(800, json.Length)]);

        try
        {
            var msg = JsonSerializer.Deserialize<DarwinMessage>(json);
            var ur = msg?.Pport?.UpdateResponse;
            if (ur is null) return;

            if (ur.Schedules is not null)
                foreach (var s in ur.Schedules)
                    IndexSchedule(s);

            if (ur.TrainStatuses is not null)
                foreach (var ts in ur.TrainStatuses)
                    ProcessTrainStatus(ts);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse Darwin message");
        }
    }

    private void IndexSchedule(Schedule s)
    {
        if (s.TrainId is null) return;
        _headcodeByRid[s.Rid] = s.TrainId;

        var destTiploc = s.Destination?.Tiploc ?? s.OperationalDestination?.Tiploc;
        var destName = destTiploc is not null ? _tiplocs.Get(destTiploc)?.Name : null;

        _registry.UpdateFromDarwin(s.TrainId, s.Toc, destName, 0);
    }

    private void ProcessTrainStatus(TrainStatus ts)
    {
        var headcode = ts.TrainId ?? (_headcodeByRid.TryGetValue(ts.Rid, out var h) ? h : null);
        if (headcode is null || ts.Locations is null) return;

        var delay = CalculateDelay(ts.Locations);
        _registry.UpdateFromDarwin(headcode, toc: null, destination: null, delay);
    }

    private static int CalculateDelay(LocationStatus[] locations)
    {
        for (int i = locations.Length - 1; i >= 0; i--)
        {
            var loc = locations[i];
            if (loc.ActualDeparture is not null && loc.PlannedDeparture is not null)
                return MinutesDiff(loc.ActualDeparture, loc.PlannedDeparture);
            if (loc.ActualArrival is not null && loc.PlannedArrival is not null)
                return MinutesDiff(loc.ActualArrival, loc.PlannedArrival);
        }
        return 0;
    }

    private static int MinutesDiff(string actual, string planned)
    {
        if (!TimeSpan.TryParseExact(actual, @"hh\:mm", null, out var a)) return 0;
        if (!TimeSpan.TryParseExact(planned, @"hh\:mm", null, out var p)) return 0;
        return (int)(a - p).TotalMinutes;
    }
}
