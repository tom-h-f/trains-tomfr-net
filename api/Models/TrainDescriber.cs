using System.Text.Json.Serialization;

namespace Api.Models;

// TD messages arrive as a JSON array of heterogeneous message objects
// Each element has exactly one key: "CA_MSG", "CB_MSG", "CC_MSG", or "CT_MSG"

public record TdCaMsg(
    [property: JsonPropertyName("time")] string Time,
    [property: JsonPropertyName("area_id")] string AreaId,
    [property: JsonPropertyName("from")] string From,
    [property: JsonPropertyName("to")] string To,
    [property: JsonPropertyName("descr")] string Descr
);

public record TdCbMsg(
    [property: JsonPropertyName("time")] string Time,
    [property: JsonPropertyName("area_id")] string AreaId,
    [property: JsonPropertyName("from")] string From,
    [property: JsonPropertyName("descr")] string Descr
);

public record TdCcMsg(
    [property: JsonPropertyName("time")] string Time,
    [property: JsonPropertyName("area_id")] string AreaId,
    [property: JsonPropertyName("to")] string To,
    [property: JsonPropertyName("descr")] string Descr
);

public record TdBerthPosition(string AreaId, string BerthId);
