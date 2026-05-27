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

    private int _tdMessages;
    private int _darwinMessages;
    private int _berthHits;
    private int _berthMisses;
    private string? _lastTdSample;
    private string? _lastDarwinSample;

    public TrainRegistry(TrainStateService state)
    {
        _state = state;
    }

    public object GetDebugInfo() => new
    {
        TdMessages = _tdMessages,
        DarwinMessages = _darwinMessages,
        BerthHits = _berthHits,
        BerthMisses = _berthMisses,
        TrainsWithPosition = _trains.Values.Count(t => t.Lat.HasValue),
        TrainsTotal = _trains.Count,
        LastTdSample = _lastTdSample,
        LastDarwinSample = _lastDarwinSample,
    };

    public void UpdateFromTd(string headcode, TdBerthPosition berth, double? lat, double? lng)
    {
        Interlocked.Increment(ref _tdMessages);
        if (lat.HasValue) Interlocked.Increment(ref _berthHits);
        else Interlocked.Increment(ref _berthMisses);

        if (_tdMessages <= 5)
            _lastTdSample = $"headcode={headcode} area={berth.AreaId} berth={berth.BerthId} lat={lat} lng={lng}";

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
        Interlocked.Increment(ref _darwinMessages);
        if (_darwinMessages <= 3)
            _lastDarwinSample = $"headcode={headcode} toc={toc} dest={destination} delay={delayMinutes}";

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
