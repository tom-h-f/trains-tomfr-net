using System.Text.Json;
using System.Text.Json.Nodes;
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
    private static readonly JsonSerializerOptions JsonOpts =
        new() { PropertyNameCaseInsensitive = true };

    private readonly KafkaOptions _opts;
    private readonly TrainRegistry _registry;
    private readonly TiplocRepository _tiplocs;
    private readonly ILogger<KafkaConsumerService> _logger;

    // rid -> headcode, populated from schedule messages
    private readonly Dictionary<string, string> _ridToHeadcode = new();

    private int _rawCount;

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
                    var result = consumer.Consume(TimeSpan.FromMilliseconds(300));
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
        finally { consumer.Close(); }
    }

    private void ProcessMessage(string outerJson)
    {
        try
        {
            // Unwrap outer Kafka envelope - Darwin JSON is in the "bytes" field
            var envelope = JsonSerializer.Deserialize<DarwinEnvelope>(outerJson, JsonOpts);
            if (envelope?.Bytes is null) return;

            if (Interlocked.Increment(ref _rawCount) <= 3)
                _logger.LogInformation("Darwin inner sample: {Json}", envelope.Bytes[..Math.Min(600, envelope.Bytes.Length)]);

            var msg = JsonSerializer.Deserialize<DarwinMessage>(envelope.Bytes, JsonOpts);
            var ur = msg?.UR;
            if (ur is null) return;

            if (ur.Schedule.HasValue)
                foreach (var s in Unwrap<Schedule>(ur.Schedule.Value))
                    IndexSchedule(s);

            if (ur.TS.HasValue)
                foreach (var ts in Unwrap<TrainStatus>(ur.TS.Value))
                    ProcessTrainStatus(ts);

            if (ur.Deactivated.HasValue)
                foreach (var d in Unwrap<JsonElement>(ur.Deactivated.Value))
                {
                    var rid = d.TryGetProperty("rid", out var r) ? r.GetString() : null;
                    if (rid is not null) _registry.RemoveByRid(rid);
                }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse Darwin message");
        }
    }

    private void IndexSchedule(Schedule s)
    {
        if (s.TrainId is not null)
            _ridToHeadcode[s.Rid] = s.TrainId;

        var destTiploc = DestinationTiploc(s);
        var destName = destTiploc is not null ? _tiplocs.Get(destTiploc)?.Name : null;

        _registry.UpdateFromDarwin(s.Rid, s.TrainId, s.Toc, destName, 0);
    }

    private void ProcessTrainStatus(TrainStatus ts)
    {
        if (!ts.Location.HasValue) return;

        var locations = Unwrap<LocationStatus>(ts.Location.Value).ToList();
        if (locations.Count == 0) return;

        var headcode = ts.TrainId
            ?? (_ridToHeadcode.TryGetValue(ts.Rid, out var h) ? h : null);

        var delay = CalculateDelay(locations);

        // Destination = last public stop with a planned arrival
        var destTiploc = locations.LastOrDefault(l => l.PlannedArrival is not null)?.Tiploc
            ?? locations.Last().Tiploc;
        var destName = _tiplocs.Get(destTiploc)?.Name;

        _registry.UpdateFromDarwin(ts.Rid, headcode, toc: null, destName, delay);
    }

    private static int CalculateDelay(List<LocationStatus> locations)
    {
        // Walk backwards to find the most recent actual time vs planned
        for (int i = locations.Count - 1; i >= 0; i--)
        {
            var loc = locations[i];
            if (loc.Dep?.Actual is not null && loc.PlannedDeparture is not null)
                return MinutesDiff(loc.Dep.Actual, loc.PlannedDeparture);
            if (loc.Arr?.Actual is not null && loc.PlannedArrival is not null)
                return MinutesDiff(loc.Arr.Actual, loc.PlannedArrival);
        }
        return 0;
    }

    private static string? DestinationTiploc(Schedule s)
    {
        if (s.Destination.HasValue)
        {
            var loc = s.Destination.Value.Deserialize<ScheduleLocation>(new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (loc?.Tiploc is not null) return loc.Tiploc;
        }
        if (s.OpDestination.HasValue)
        {
            var loc = s.OpDestination.Value.Deserialize<ScheduleLocation>(new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (loc?.Tiploc is not null) return loc.Tiploc;
        }
        return null;
    }

    private static IEnumerable<T> Unwrap<T>(JsonElement el)
    {
        if (el.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in el.EnumerateArray())
            {
                var v = item.Deserialize<T>(new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                if (v is not null) yield return v;
            }
        }
        else if (el.ValueKind == JsonValueKind.Object)
        {
            var v = el.Deserialize<T>(new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (v is not null) yield return v;
        }
    }

    private static int MinutesDiff(string actual, string planned)
    {
        if (!TimeSpan.TryParse(actual, out var a)) return 0;
        if (!TimeSpan.TryParse(planned, out var p)) return 0;
        return (int)(a - p).TotalMinutes;
    }
}
