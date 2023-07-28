# How to build the Zig compiler for WASI

TODO: Submit an actually good PR that isn't a hack

Apply this patch:

```patch
diff --git a/build.zig b/build.zig
index 9e6e86386..ec8b6b9bd 100644
--- a/build.zig
+++ b/build.zig
@@ -237,7 +237,7 @@ pub fn build(b: *std.Build) !void {
     exe_options.addOption(bool, "llvm_has_xtensa", llvm_has_xtensa);
     exe_options.addOption(bool, "force_gpa", force_gpa);
     exe_options.addOption(bool, "only_c", only_c);
-    exe_options.addOption(bool, "only_core_functionality", only_c);
+    exe_options.addOption(bool, "only_core_functionality", true);

     if (link_libc) {
         exe.linkLibC();
diff --git a/src/link.zig b/src/link.zig
index 703dfb873..3bc4039e7 100644
--- a/src/link.zig
+++ b/src/link.zig
@@ -765,9 +765,9 @@ pub const File = struct {
     /// Commit pending changes and write headers. Takes into account final output mode
     /// and `use_lld`, not only `effectiveOutputMode`.
     pub fn flush(base: *File, comp: *Compilation, prog_node: *std.Progress.Node) FlushError!void {
-        if (build_options.only_c) {
-            assert(base.tag == .c);
-            return @fieldParentPtr(C, "base", base).flush(comp, prog_node);
+        if (true) {
+            assert(base.tag == .wasm);
+            return @fieldParentPtr(Wasm, "base", base).flush(comp, prog_node);
         }
         if (comp.clang_preprocessor_mode == .yes) {
             const emit = base.options.emit orelse return; // -fno-emit-bin
diff --git a/src/link/Wasm/Archive.zig b/src/link/Wasm/Archive.zig
index c4fb9b829..7fdc018ab 100644
--- a/src/link/Wasm/Archive.zig
+++ b/src/link/Wasm/Archive.zig
@@ -208,9 +208,9 @@ pub fn parseObject(archive: Archive, allocator: Allocator, file_offset: u32) !Ob

     const object_name = try archive.parseName(header);
     const name = name: {
-        var buffer: [std.fs.MAX_PATH_BYTES]u8 = undefined;
-        const path = try std.os.realpath(archive.name, &buffer);
-        break :name try std.fmt.allocPrint(allocator, "{s}({s})", .{ path, object_name });
+        // var buffer: [std.fs.MAX_PATH_BYTES]u8 = undefined;
+        // const path = try std.os.realpath(archive.name, &buffer);
+        break :name try std.fmt.allocPrint(allocator, "{s}({s})", .{ archive.name, object_name });
     };
     defer allocator.free(name);

diff --git a/src/main.zig b/src/main.zig
index 39a7adc42..616518d15 100644
--- a/src/main.zig
+++ b/src/main.zig
@@ -200,7 +200,7 @@ pub fn main() anyerror!void {
     }

     // Short circuit some of the other logic for bootstrapping.
-    if (build_options.only_c) {
+    if (true) {
         if (mem.eql(u8, args[1], "build-exe")) {
             return buildOutputType(gpa, arena, args, .{ .build = .Exe });
         } else if (mem.eql(u8, args[1], "build-obj")) {
@@ -1544,7 +1544,7 @@ fn buildOutputType(
             }
         },
         .cc, .cpp => {
-            if (build_options.only_c) unreachable;
+            if (true) unreachable;

             emit_h = .no;
             soname = .no;
@@ -3238,7 +3238,7 @@ fn buildOutputType(
     switch (listen) {
         .none => {},
         .stdio => {
-            if (build_options.only_c) unreachable;
+            if (true) unreachable;
             try serve(
                 comp,
                 std.io.getStdIn(),
@@ -3286,7 +3286,7 @@ fn buildOutputType(
         error.SemanticAnalyzeFail => if (listen == .none) process.exit(1),
         else => |e| return e,
     };
-    if (build_options.only_c) return cleanExit();
+    if (true) return cleanExit();
     try comp.makeBinFileExecutable();

     if (test_exec_args.items.len == 0 and object_format == .c) default_exec_args: {
```

then:

```bash
../zig-from-website/zig build -Dtarget=wasm32-wasi -Doptimize=ReleaseSmall -Dno-langref -Dno-autodocs -Dno-lib
```
