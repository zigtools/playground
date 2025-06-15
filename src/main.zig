const std = @import("std");
const zls = @import("zls");
const AnyTransport = zls.lsp.AnyTransport;

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

const WasmTransport = struct {
    did_read: bool,

    pub fn any(_: *WasmTransport) AnyTransport {
        return .{ .impl = .{
            .transport = &transport,
            .readJsonMessage = @ptrCast(&readJsonMessage),
            .writeJsonMessage = @ptrCast(&writeJsonMessage),
        } };
    }

    pub fn readJsonMessage(
        _: *WasmTransport,
        _: std.mem.Allocator,
    ) (std.mem.Allocator.Error || AnyTransport.ReadError)![]u8 {
        if (transport.did_read) {
            return error.EndOfStream;
        }

        defer transport.did_read = true;
        return try allocator.dupe(u8, input_bytes.items);
    }

    pub fn writeJsonMessage(
        _: *WasmTransport,
        json_message: []const u8,
    ) AnyTransport.WriteError!void {
        output_message_starts.append(
            allocator,
            output_message_bytes.items.len,
        ) catch return error.NoSpaceLeft;
        output_message_bytes.appendSlice(
            allocator,
            json_message,
        ) catch return error.NoSpaceLeft;
    }
};

var server: *zls.Server = undefined;
var transport: WasmTransport = .{ .did_read = false };

var input_bytes: std.ArrayListUnmanaged(u8) = .empty;

var output_message_starts: std.ArrayListUnmanaged(usize) = .empty;
var output_message_bytes: std.ArrayListUnmanaged(u8) = .empty;

export fn createServer() void {
    server = zls.Server.create(allocator) catch @panic("server creation failed");
    server.setTransport(transport.any());
}

export fn allocMessage(len: usize) [*]const u8 {
    input_bytes.clearRetainingCapacity();
    input_bytes.resize(allocator, len) catch @panic("OOM");
    return input_bytes.items.ptr;
}

export fn call() void {
    transport.did_read = false;
    output_message_starts.clearRetainingCapacity();
    output_message_bytes.clearRetainingCapacity();

    server.loop() catch |err| switch (err) {
        error.EndOfStream => {},
        else => std.debug.panic("{any}", .{err}),
    };
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
