using System.Text.Json;
using System.Text.Json.Serialization;

namespace Api.Models;

// Outer Kafka envelope - actual Darwin JSON is in the "bytes" field
public record DarwinEnvelope(
    [property: JsonPropertyName("bytes")] string? Bytes
);

public record DarwinMessage(
    [property: JsonPropertyName("uR")] UpdateResponse? UR
);

public record UpdateResponse(
    [property: JsonPropertyName("updateOrigin")] string? UpdateOrigin,
    // TS and schedule can each be a single object or an array - use JsonElement
    [property: JsonPropertyName("TS")] JsonElement? TS,
    [property: JsonPropertyName("schedule")] JsonElement? Schedule,
    [property: JsonPropertyName("deactivated")] JsonElement? Deactivated
);

public record TrainStatus(
    [property: JsonPropertyName("rid")] string Rid,
    [property: JsonPropertyName("uid")] string? Uid,
    [property: JsonPropertyName("ssd")] string? Ssd,
    [property: JsonPropertyName("trainId")] string? TrainId,
    [property: JsonPropertyName("LateReason")] string? LateReason,
    // Location is single object or array - resolved in consumer
    [property: JsonPropertyName("Location")] JsonElement? Location
);

public record LocationStatus(
    [property: JsonPropertyName("tpl")] string Tiploc,
    [property: JsonPropertyName("pta")] string? PlannedArrival,
    [property: JsonPropertyName("ptd")] string? PlannedDeparture,
    [property: JsonPropertyName("wta")] string? WorkingArrival,
    [property: JsonPropertyName("wtd")] string? WorkingDeparture,
    [property: JsonPropertyName("wtp")] string? WorkingPass,
    [property: JsonPropertyName("arr")] TimingDetail? Arr,
    [property: JsonPropertyName("dep")] TimingDetail? Dep,
    [property: JsonPropertyName("pass")] TimingDetail? Pass
);

public record TimingDetail(
    [property: JsonPropertyName("at")] string? Actual,
    [property: JsonPropertyName("et")] string? Estimated,
    [property: JsonPropertyName("src")] string? Source
);

public record Schedule(
    [property: JsonPropertyName("rid")] string Rid,
    [property: JsonPropertyName("uid")] string? Uid,
    [property: JsonPropertyName("trainId")] string? TrainId,
    [property: JsonPropertyName("toc")] string? Toc,
    // Locations in schedule - single or array
    [property: JsonPropertyName("OR")] JsonElement? Origin,
    [property: JsonPropertyName("DT")] JsonElement? Destination,
    [property: JsonPropertyName("IP")] JsonElement? IntermediatePoints,
    [property: JsonPropertyName("PP")] JsonElement? PassingPoints,
    [property: JsonPropertyName("OPOR")] JsonElement? OpOrigin,
    [property: JsonPropertyName("OPDT")] JsonElement? OpDestination
);

public record ScheduleLocation(
    [property: JsonPropertyName("tpl")] string Tiploc,
    [property: JsonPropertyName("ptd")] string? PlannedDeparture,
    [property: JsonPropertyName("pta")] string? PlannedArrival
);
