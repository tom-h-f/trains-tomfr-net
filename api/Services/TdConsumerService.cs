using System.Text.Json;
using System.Text.Json.Nodes;
using Api.Models;
using Confluent.Kafka;
using Microsoft.Extensions.Options;

namespace Api.Services;

public class TdKafkaOptions
{
    public string BootstrapServers { get; set; } = "";
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
    public string GroupId { get; set; } = "";
    public string Topic { get; set; } = "";
}

public class TdConsumerService : BackgroundService
{
    private readonly TdKafkaOptions _opts;
    private readonly TrainRegistry _registry;
    private readonly BerthRepository _berths;
    private readonly ILogger<TdConsumerService> _logger;

    public TdConsumerService(
        IOptions<TdKafkaOptions> opts,
        TrainRegistry registry,
        BerthRepository berths,
        ILogger<TdConsumerService> logger)
    {
        _opts = opts.Value;
        _registry = registry;
        _berths = berths;
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

        _logger.LogInformation("TD consumer started, topic: {Topic}", _opts.Topic);

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
                    _logger.LogError(ex, "TD Kafka consume error");
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
            _logger.LogInformation("TD raw sample: {Json}", json[..Math.Min(500, json.Length)]);

        try
        {
            // TD messages are arrays of heterogeneous objects
            var array = JsonNode.Parse(json)?.AsArray();
            if (array is null)
            {
                if (_rawCount <= 3) _logger.LogWarning("TD message not a JSON array");
                return;
            }

            foreach (var item in array)
            {
                if (item is null) continue;

                var obj = item.AsObject();
                foreach (var (key, value) in obj)
                {
                    if (value is null) continue;
                    switch (key)
                    {
                        case "CA_MSG":
                            ProcessCa(value.Deserialize<TdCaMsg>());
                            break;
                        case "CB_MSG":
                            ProcessCb(value.Deserialize<TdCbMsg>());
                            break;
                        case "CC_MSG":
                            ProcessCc(value.Deserialize<TdCcMsg>());
                            break;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Failed to parse TD message");
        }
    }

    private void ProcessCa(TdCaMsg? msg)
    {
        if (msg is null || string.IsNullOrWhiteSpace(msg.Descr) || msg.Descr == "0000") return;

        var berth = new TdBerthPosition(msg.AreaId, msg.To);
        var loc = _berths.Get(msg.AreaId, msg.To);
        _registry.UpdateFromTd(msg.Descr, berth, loc?.Lat, loc?.Lng);
    }

    private void ProcessCb(TdCbMsg? msg)
    {
        if (msg is null || string.IsNullOrWhiteSpace(msg.Descr) || msg.Descr == "0000") return;
        _registry.RemoveFromTd(msg.Descr);
    }

    private void ProcessCc(TdCcMsg? msg)
    {
        if (msg is null || string.IsNullOrWhiteSpace(msg.Descr) || msg.Descr == "0000") return;

        var berth = new TdBerthPosition(msg.AreaId, msg.To);
        var loc = _berths.Get(msg.AreaId, msg.To);
        _registry.UpdateFromTd(msg.Descr, berth, loc?.Lat, loc?.Lng);
    }
}
