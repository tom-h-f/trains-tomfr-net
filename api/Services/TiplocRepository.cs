using System.Text.Json;

namespace Api.Services;

public record TiplocLocation(double Lat, double Lng, string Name);

public class TiplocRepository
{
    private readonly Dictionary<string, TiplocLocation> _locations;

    public TiplocRepository(IWebHostEnvironment env)
    {
        var path = Path.Combine(env.ContentRootPath, "Data", "tiplocs.json");
        if (File.Exists(path))
        {
            var json = File.ReadAllText(path);
            _locations = JsonSerializer.Deserialize<Dictionary<string, TiplocLocation>>(json,
                             new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                         ?? new Dictionary<string, TiplocLocation>();
        }
        else
        {
            _locations = new Dictionary<string, TiplocLocation>();
        }
    }

    public TiplocLocation? Get(string tiploc) =>
        _locations.TryGetValue(tiploc, out var loc) ? loc : null;

    public bool Has(string tiploc) => _locations.ContainsKey(tiploc);
}
