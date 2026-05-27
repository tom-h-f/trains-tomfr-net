using System.Text.Json;

namespace Api.Services;

public record BerthLocation(double Lat, double Lng);

public class BerthRepository
{
    // Key: "AREAID_BERTHID" e.g. "WX_0100"
    private readonly Dictionary<string, BerthLocation> _berths;

    public BerthRepository(IWebHostEnvironment env)
    {
        var path = Path.Combine(env.ContentRootPath, "Data", "berths.json");
        if (File.Exists(path))
        {
            var json = File.ReadAllText(path);
            _berths = JsonSerializer.Deserialize<Dictionary<string, BerthLocation>>(json)
                      ?? new Dictionary<string, BerthLocation>();
        }
        else
        {
            _berths = new Dictionary<string, BerthLocation>();
        }
    }

    public BerthLocation? Get(string areaId, string berthId) =>
        _berths.TryGetValue($"{areaId}_{berthId}", out var loc) ? loc : null;
}
