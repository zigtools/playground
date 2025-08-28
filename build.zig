const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.resolveTargetQuery(.{ .cpu_arch = .wasm32, .os_tag = .wasi });
    const optimize: std.builtin.OptimizeMode = b.standardOptimizeOption(.{ .preferred_optimize_mode = .ReleaseSmall });

    const enable_wasm_opt = b.option(bool, "wasm-opt", "Run wasm-opt") orelse false;

    const zls_step = b.step("zls", "compile and install ZLS");
    const zig_step = b.step("zig", "compile and install Zig");
    const tarball_step = b.step("zig_tarball", "compile and install zig.tar.gz");

    b.getInstallStep().dependOn(zls_step);
    b.getInstallStep().dependOn(zig_step);
    b.getInstallStep().dependOn(tarball_step);

    const zls_dependency = b.dependency("zls", .{
        .target = target,
        .optimize = optimize,
        // .@"version-string" = @as([]const u8, "0.16.0-dev"),
    });

    const zls_exe = b.addExecutable(.{
        .name = "zls",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/zls.zig"),
            .target = target,
            .optimize = optimize,
            .imports = &.{
                .{ .name = "zls", .module = zls_dependency.module("zls") },
            },
        }),
    });
    zls_exe.entry = .disabled;
    zls_exe.rdynamic = true;
    zls_step.dependOn(installArtifact(b, zls_exe, enable_wasm_opt));

    const zig_dependency = b.dependency("zig", .{
        .target = target,
        .optimize = optimize,
        .@"version-string" = @as([]const u8, "0.15.1"),
        .@"no-lib" = true,
        .dev = "wasm",
    });
    zig_step.dependOn(installArtifact(b, zig_dependency.artifact("zig"), enable_wasm_opt));

    const run_tar = b.addSystemCommand(&.{ "tar", "-czf" });
    const zig_tar_gz = run_tar.addOutputFileArg("zig.tar.gz");
    tarball_step.dependOn(&b.addInstallFile(zig_tar_gz, "zig.tar.gz").step);
    run_tar.addArg("-C");
    run_tar.addDirectoryArg(zig_dependency.path("."));
    run_tar.addArg("lib/std");
}

fn installArtifact(b: *std.Build, artifact: *std.Build.Step.Compile, enable_wasm_opt: bool) *std.Build.Step {
    if (enable_wasm_opt) {
        const wasm_opt = b.addSystemCommand(&.{
            "wasm-opt",
            "-Oz",
            "--enable-bulk-memory",
            "--enable-mutable-globals",
            "--enable-nontrapping-float-to-int",
            "--enable-sign-ext",
        });
        wasm_opt.addArtifactArg(artifact);
        wasm_opt.addArg("-o");
        const file_name = b.fmt("{s}.wasm", .{artifact.name});
        const exe = wasm_opt.addOutputFileArg(file_name);
        return &b.addInstallBinFile(exe, file_name).step;
    } else {
        return &b.addInstallArtifact(artifact, .{}).step;
    }
}
