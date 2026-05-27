using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Api.Models;

namespace Api.Services;

public class TrainStateService
{
    private readonly ConcurrentDictionary<string, TrainPosition> _trains = new();
    private readonly ConcurrentDictionary<string, WebSocket> _clients = new();
    private readonly ILogger<TrainStateService> _logger;

    public TrainStateService(ILogger<TrainStateService> logger)
    {
        _logger = logger;
    }

    public void UpdateTrain(TrainPosition position)
    {
        _trains[position.Rid] = position;
        _ = BroadcastUpdateAsync(position);
    }

    public void RemoveTrain(string rid)
    {
        _trains.TryRemove(rid, out _);
        _ = BroadcastRemovalAsync(rid);
    }

    public async Task HandleClientAsync(WebSocket ws, CancellationToken ct)
    {
        var clientId = Guid.NewGuid().ToString();
        _clients[clientId] = ws;

        try
        {
            await SendSnapshotAsync(ws, ct);

            var buffer = new byte[1024];
            while (ws.State == WebSocketState.Open && !ct.IsCancellationRequested)
            {
                var result = await ws.ReceiveAsync(buffer, ct);
                if (result.MessageType == WebSocketMessageType.Close)
                    break;
            }
        }
        finally
        {
            _clients.TryRemove(clientId, out _);
            if (ws.State == WebSocketState.Open)
                await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, null, CancellationToken.None);
        }
    }

    private async Task SendSnapshotAsync(WebSocket ws, CancellationToken ct)
    {
        var snapshot = new { type = "snapshot", trains = _trains.Values.ToArray() };
        await SendJsonAsync(ws, snapshot, ct);
    }

    private async Task BroadcastUpdateAsync(TrainPosition position)
    {
        var msg = new { type = "update", train = position };
        await BroadcastAsync(msg);
    }

    private async Task BroadcastRemovalAsync(string rid)
    {
        var msg = new { type = "remove", rid };
        await BroadcastAsync(msg);
    }

    private async Task BroadcastAsync(object message)
    {
        var dead = new List<string>();

        foreach (var (id, ws) in _clients)
        {
            if (ws.State != WebSocketState.Open)
            {
                dead.Add(id);
                continue;
            }
            try
            {
                await SendJsonAsync(ws, message, CancellationToken.None);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send to client {Id}", id);
                dead.Add(id);
            }
        }

        foreach (var id in dead)
            _clients.TryRemove(id, out _);
    }

    private static async Task SendJsonAsync(WebSocket ws, object message, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(message, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });
        var bytes = Encoding.UTF8.GetBytes(json);
        await ws.SendAsync(bytes, WebSocketMessageType.Text, true, ct);
    }
}
