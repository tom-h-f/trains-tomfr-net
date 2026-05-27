namespace Api.Models;

public record TrainPosition(
    string Rid,
    string? Headcode,
    string? Toc,
    double Lat,
    double Lng,
    string? FromTiploc,
    string? ToTiploc,
    string? Origin,
    string? Destination,
    int DelayMinutes,
    double? Heading,
    DateTime UpdatedAt
);

public record TrainStateSnapshot(IReadOnlyList<TrainPosition> Trains);
