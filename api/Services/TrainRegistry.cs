using System.Collections.Concurrent;
using Api.Models;

namespace Api.Services;

public class TrainRegistry
{
    private record TrainEntry(
        string Headcode,
        string? Toc,
        string? Destination,
        int DelayMinutes,
        TdBerthPosition? Berth,
        double? Lat,
        double? Lng,
        DateTime UpdatedAt
    );

    private readonly ConcurrentDictionary<string, TrainEntry> _trains = new();
    private readonly TrainStateService _state;

    public TrainRegistry(TrainStateService state)
    {
        _state = state;
    }

    public void UpdateFromTd(string headcode, TdBerthPosition berth, double? lat, double? lng)
    {
        var entry = _trains.AddOrUpdate(
            headcode,
            _ => new TrainEntry(headcode, null, null, 0, berth, lat, lng, DateTime.UtcNow),
            (_, existing) => existing with { Berth = berth, Lat = lat, Lng = lng, UpdatedAt = DateTime.UtcNow }
        );

        if (lat.HasValue && lng.HasValue)
            PublishPosition(headcode, entry);
    }

    public void UpdateFromDarwin(string headcode, string? toc, string? destination, int delayMinutes)
    {
        var entry = _trains.AddOrUpdate(
            headcode,
            _ => new TrainEntry(headcode, toc, destination, delayMinutes, null, null, null, DateTime.UtcNow),
            (_, existing) => existing with { Toc = toc, Destination = destination, DelayMinutes = delayMinutes }
        );

        if (entry.Lat.HasValue && entry.Lng.HasValue)
            PublishPosition(headcode, entry);
    }

    public void RemoveFromTd(string headcode)
    {
        if (_trains.TryRemove(headcode, out _))
            _state.RemoveTrain(headcode);
    }

    private void PublishPosition(string headcode, TrainEntry entry)
    {
        if (!entry.Lat.HasValue || !entry.Lng.HasValue) return;

        var position = new TrainPosition(
            headcode,
            headcode,
            entry.Toc,
            entry.Lat.Value,
            entry.Lng.Value,
            entry.Berth?.AreaId,
            entry.Berth?.BerthId,
            entry.Destination,
            entry.DelayMinutes,
            entry.UpdatedAt
        );

        _state.UpdateTrain(position);
    }
}
