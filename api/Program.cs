using Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<KafkaOptions>(builder.Configuration.GetSection("Kafka"));
builder.Services.Configure<TdKafkaOptions>(builder.Configuration.GetSection("KafkaTd"));

builder.Services.AddSingleton<TiplocRepository>();
builder.Services.AddSingleton<BerthRepository>();
builder.Services.AddSingleton<TrainStateService>();
builder.Services.AddSingleton<TrainRegistry>();

builder.Services.AddHostedService<KafkaConsumerService>();
builder.Services.AddHostedService<TdConsumerService>();

var app = builder.Build();

app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(30) });

app.MapGet("/ws", async (HttpContext ctx, TrainStateService trainState) =>
{
    if (!ctx.WebSockets.IsWebSocketRequest)
    {
        ctx.Response.StatusCode = 400;
        return;
    }

    var ws = await ctx.WebSockets.AcceptWebSocketAsync();
    await trainState.HandleClientAsync(ws, ctx.RequestAborted);
});

app.MapGet("/health", () => Results.Ok());

app.MapGet("/debug", (TrainStateService trainState, TrainRegistry registry) =>
    Results.Ok(registry.GetDebugInfo()));

app.Run();
