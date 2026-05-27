using System.Text.Json.Serialization;

namespace Api.Models;

public record DarwinMessage(
    [property: JsonPropertyName("Pport")] Pport? Pport
);

public record Pport(
    [property: JsonPropertyName("uR")] UpdateResponse? UpdateResponse
);

public record UpdateResponse(
    [property: JsonPropertyName("TS")] TrainStatus[]? TrainStatuses,
    [property: JsonPropertyName("schedule")] Schedule[]? Schedules,
    [property: JsonPropertyName("deactivated")] Deactivated[]? Deactivated
);

public record TrainStatus(
    [property: JsonPropertyName("rid")] string Rid,
    [property: JsonPropertyName("uid")] string Uid,
    [property: JsonPropertyName("ssd")] string Ssd,
    [property: JsonPropertyName("trainId")] string? TrainId,
    [property: JsonPropertyName("ns")] LocationStatus[]? Locations,
    [property: JsonPropertyName("LateReason")] LateReason? LateReason
);

public record LocationStatus(
    [property: JsonPropertyName("tpl")] string Tiploc,
    [property: JsonPropertyName("pta")] string? PlannedArrival,
    [property: JsonPropertyName("ptd")] string? PlannedDeparture,
    [property: JsonPropertyName("eta")] string? EstimatedArrival,
    [property: JsonPropertyName("etd")] string? EstimatedDeparture,
    [property: JsonPropertyName("ata")] string? ActualArrival,
    [property: JsonPropertyName("atd")] string? ActualDeparture,
    [property: JsonPropertyName("wta")] string? WorkingArrival,
    [property: JsonPropertyName("wtd")] string? WorkingDeparture,
    [property: JsonPropertyName("wtp")] string? WorkingPass
);

public record Schedule(
    [property: JsonPropertyName("rid")] string Rid,
    [property: JsonPropertyName("uid")] string Uid,
    [property: JsonPropertyName("trainId")] string? TrainId,
    [property: JsonPropertyName("toc")] string? Toc,
    [property: JsonPropertyName("OR")] ScheduleLocation? Origin,
    [property: JsonPropertyName("DT")] ScheduleLocation? Destination,
    [property: JsonPropertyName("PP")] ScheduleLocation[]? PassingPoints,
    [property: JsonPropertyName("IP")] ScheduleLocation[]? IntermediatePoints,
    [property: JsonPropertyName("OPOR")] ScheduleLocation? OperationalOrigin,
    [property: JsonPropertyName("OPDT")] ScheduleLocation? OperationalDestination
);

public record ScheduleLocation(
    [property: JsonPropertyName("tpl")] string Tiploc,
    [property: JsonPropertyName("ptd")] string? PlannedDeparture,
    [property: JsonPropertyName("pta")] string? PlannedArrival,
    [property: JsonPropertyName("wtp")] string? WorkingPass
);

public record LateReason(
    [property: JsonPropertyName("value")] string? Value
);

public record Deactivated(
    [property: JsonPropertyName("rid")] string Rid
);
