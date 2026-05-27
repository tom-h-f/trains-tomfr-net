using System.Collections.Concurrent;
using Api.Models;

namespace Api.Services;

public class TrainRegistry
{
    private record TrainEntry(
        string Rid,
        string? Headcode,
        string? Toc,
        string? Origin,
        string? Destination,
        int DelayMinutes,
        TdBerthPosition? Berth,
        double? Lat,
        double? Lng,
        double? DestLat,
        double? DestLng,
        DateTime UpdatedAt
    );

    private readonly ConcurrentDictionary<string, TrainEntry> _trains = new();
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

        var rid = _headcodeToRid.TryGetValue(headcode, out var r) ? r : headcode;

        var entry = _trains.AddOrUpdate(
            rid,
            _ => new TrainEntry(rid, headcode, null, null, null, 0, berth, lat, lng, null, null, DateTime.UtcNow),
            (_, existing) => existing with { Headcode = headcode, Berth = berth, Lat = lat, Lng = lng, UpdatedAt = DateTime.UtcNow }
        );

        if (lat.HasValue && lng.HasValue)
            PublishPosition(rid, entry);
    }

    public void UpdateFromDarwin(string rid, string? headcode, string? toc, string? origin, string? destination, int delayMinutes,
        double? destLat = null, double? destLng = null)
    {
        Interlocked.Increment(ref _darwinMessages);
        if (_darwinMessages <= 5)
            _lastDarwinSample = $"rid={rid} headcode={headcode} toc={toc} origin={origin} dest={destination} delay={delayMinutes}";

        if (headcode is not null)
            _headcodeToRid[headcode] = rid;

        var entry = _trains.AddOrUpdate(
            rid,
            _ => new TrainEntry(rid, headcode, toc, origin, destination, delayMinutes, null, null, null, destLat, destLng, DateTime.UtcNow),
            (_, existing) => existing with
            {
                Headcode = headcode ?? existing.Headcode,
                Toc = toc ?? existing.Toc,
                Origin = origin ?? existing.Origin,
                Destination = destination ?? existing.Destination,
                DelayMinutes = delayMinutes,
                DestLat = destLat ?? existing.DestLat,
                DestLng = destLng ?? existing.DestLng,
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

        double? heading = null;
        if (entry.DestLat.HasValue && entry.DestLng.HasValue)
            heading = BearingDeg(entry.Lat.Value, entry.Lng.Value, entry.DestLat.Value, entry.DestLng.Value);

        var position = new TrainPosition(
            rid,
            entry.Headcode ?? rid,
            entry.Toc,
            entry.Lat.Value,
            entry.Lng.Value,
            entry.Berth?.AreaId,
            entry.Berth?.BerthId,
            entry.Origin,
            entry.Destination,
            entry.DelayMinutes,
            heading,
            entry.UpdatedAt
        );

        _state.UpdateTrain(position);
    }

    private static double BearingDeg(double lat1, double lng1, double lat2, double lng2)
    {
        var dLng = (lng2 - lng1) * Math.PI / 180;
        var φ1 = lat1 * Math.PI / 180;
        var φ2 = lat2 * Math.PI / 180;
        var y = Math.Sin(dLng) * Math.Cos(φ2);
        var x = Math.Cos(φ1) * Math.Sin(φ2) - Math.Sin(φ1) * Math.Cos(φ2) * Math.Cos(dLng);
        return (Math.Atan2(y, x) * 180 / Math.PI + 360) % 360;
    }
}
