const std = @import("std");
const zls = @import("zls");

const allocator = std.heap.wasm_allocator;

pub const std_options: std.Options = .{
    // Always set this to debug to make std.log call into our handler, then control the runtime
    // value in logFn itself
    .log_level = .debug,
    .logFn = logFn,
};

fn logFn(
    comptime level: std.log.Level,
    comptime scope: @Type(.enum_literal),
    comptime format: []const u8,
    args: anytype,
) void {
    _ = scope;
    var buffer: [4096]u8 = undefined;
    comptime std.debug.assert(buffer.len >= zls.lsp.minimum_logging_buffer_size);

    const lsp_message_type: zls.lsp.types.MessageType = switch (level) {
        .err => .Error,
        .warn => .Warning,
        .info => .Info,
        .debug => .Debug,
    };
    const json_message = zls.lsp.bufPrintLogMessage(&buffer, lsp_message_type, format, args);
    transport.writeJsonMessage(json_message) catch {};
}

var transport: zls.lsp.Transport = .{
    .vtable = &.{
        .readJsonMessage = readJsonMessage,
        .writeJsonMessage = writeJsonMessage,
    },
};

fn readJsonMessage(_: *zls.lsp.Transport, _: std.mem.Allocator) (std.mem.Allocator.Error || zls.lsp.Transport.ReadError)![]u8 {
    unreachable;
}

fn writeJsonMessage(_: *zls.lsp.Transport, json_message: []const u8) zls.lsp.Transport.WriteError!void {
    output_message_starts.append(allocator, output_message_bytes.items.len) catch return error.NoSpaceLeft;
    output_message_bytes.appendSlice(allocator, json_message) catch return error.NoSpaceLeft;
}

var server: *zls.Server = undefined;

var input_bytes: std.ArrayList(u8) = .empty;

var output_message_starts: std.ArrayList(usize) = .empty;
var output_message_bytes: std.ArrayList(u8) = .empty;

export fn createServer() void {
    server = zls.Server.create(.{
        .allocator = allocator,
        .transport = null,
        .config = null,
    }) catch @panic("server creation failed");
    server.setTransport(&transport);
}

export fn allocMessage(len: usize) [*]const u8 {
    input_bytes.clearRetainingCapacity();
    input_bytes.resize(allocator, len) catch @panic("OOM");
    return input_bytes.items.ptr;
}

export fn call() void {
    output_message_starts.clearRetainingCapacity();
    output_message_bytes.clearRetainingCapacity();

    allocator.free(
        server.sendJsonMessageSync(input_bytes.items) catch |err|
            std.debug.panic("{}", .{err}) orelse
            return,
    );
}

export fn outputMessageCount() usize {
    return output_message_starts.items.len;
}

export fn outputMessagePtr(index: usize) [*]const u8 {
    return output_message_bytes.items[output_message_starts.items[index]..].ptr;
}

export fn outputMessageLen(index: usize) usize {
    const next_start = if (index < output_message_starts.items.len - 1)
        output_message_starts.items[index + 1]
    else
        output_message_bytes.items.len;
    return next_start - output_message_starts.items[index];
}
