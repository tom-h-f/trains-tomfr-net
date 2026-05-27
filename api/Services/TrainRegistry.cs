using System.Collections.Concurrent;
using Api.Models;

namespace Api.Services;

public class TrainRegistry
{
    private record TrainEntry(
        string Rid,
        string? Headcode,
        string? Toc,
        string? Destination,
        int DelayMinutes,
        TdBerthPosition? Berth,
        double? Lat,
        double? Lng,
        DateTime UpdatedAt
    );

    // Keyed by rid (Darwin) - TD headcodes are mapped via _headcodeToRid
    private readonly ConcurrentDictionary<string, TrainEntry> _trains = new();

    // TD headcode -> rid, populated when Darwin schedule arrives first
    private readonly ConcurrentDictionary<string, string> _headcodeToRid = new();

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

        // Try to resolve headcode -> rid
        var rid = _headcodeToRid.TryGetValue(headcode, out var r) ? r : headcode;

        var entry = _trains.AddOrUpdate(
            rid,
            _ => new TrainEntry(rid, headcode, null, null, 0, berth, lat, lng, DateTime.UtcNow),
            (_, existing) => existing with { Headcode = headcode, Berth = berth, Lat = lat, Lng = lng, UpdatedAt = DateTime.UtcNow }
        );

        if (lat.HasValue && lng.HasValue)
            PublishPosition(rid, entry);
    }

    public void UpdateFromDarwin(string rid, string? headcode, string? toc, string? destination, int delayMinutes)
    {
        Interlocked.Increment(ref _darwinMessages);
        if (_darwinMessages <= 5)
            _lastDarwinSample = $"rid={rid} headcode={headcode} toc={toc} dest={destination} delay={delayMinutes}";

        if (headcode is not null)
            _headcodeToRid[headcode] = rid;

        var entry = _trains.AddOrUpdate(
            rid,
            _ => new TrainEntry(rid, headcode, toc, destination, delayMinutes, null, null, null, DateTime.UtcNow),
            (_, existing) => existing with
            {
                Headcode = headcode ?? existing.Headcode,
                Toc = toc ?? existing.Toc,
                Destination = destination ?? existing.Destination,
                DelayMinutes = delayMinutes,
            }
        );

        if (entry.Lat.HasValue && entry.Lng.HasValue)
            PublishPosition(rid, entry);
    }

    public void RemoveFromTd(string headcode)
    {
        var rid = _headcodeToRid.TryGetValue(headcode, out var r) ? r : headcode;
        if (_trains.TryRemove(rid, out _))
            _state.RemoveTrain(rid);
    }

    public void RemoveByRid(string rid)
    {
        if (_trains.TryRemove(rid, out _))
            _state.RemoveTrain(rid);
    }

    private void PublishPosition(string rid, TrainEntry entry)
    {
        if (!entry.Lat.HasValue || !entry.Lng.HasValue) return;

        var position = new TrainPosition(
            rid,
            entry.Headcode ?? rid,
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
