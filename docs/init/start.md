## 启动过程

### 初探

#### 启动顺序

### initcall

位于初始化调用位置

```c
// init/main.c
kernel_init_freeable() 
  -> do_basic_setup();
   -> do_initcalls();
```

#### 代码段

系统初始化，分为几个等级

```c
  static const char *initcall_level_names[] __initdata = {
          "pure",
          "core",
          "postcore",
          "arch",
          "subsys",
          "fs",
          "device",
          "late",
  };

 static initcall_entry_t *initcall_levels[] __initdata = {
          __initcall0_start,
          __initcall1_start,     
          __initcall2_start,
          __initcall3_start,
          __initcall4_start,
          __initcall5_start,
          __initcall6_start,
          __initcall7_start,
          __initcall_end,
  };
```

上述段会在`linker`阶段把属于各个段的初始化函数放在段里面

函数如何声明为属于某个初始化段

```c
  #define pure_initcall(fn)               __define_initcall(fn, 0)
          
  #define core_initcall(fn)               __define_initcall(fn, 1)
  #define core_initcall_sync(fn)          __define_initcall(fn, 1s)
  #define postcore_initcall(fn)           __define_initcall(fn, 2)
  #define postcore_initcall_sync(fn)      __define_initcall(fn, 2s)
  #define arch_initcall(fn)               __define_initcall(fn, 3)
  #define arch_initcall_sync(fn)          __define_initcall(fn, 3s)
  #define subsys_initcall(fn)             __define_initcall(fn, 4)
  #define subsys_initcall_sync(fn)        __define_initcall(fn, 4s)
  #define fs_initcall(fn)                 __define_initcall(fn, 5)
  #define fs_initcall_sync(fn)            __define_initcall(fn, 5s)
  #define rootfs_initcall(fn)             __define_initcall(fn, rootfs)
  #define device_initcall(fn)             __define_initcall(fn, 6)
  #define device_initcall_sync(fn)        __define_initcall(fn, 6s)
  #define late_initcall(fn)               __define_initcall(fn, 7)
  #define late_initcall_sync(fn)          __define_initcall(fn, 7s)
          
  #define __initcall(fn) device_initcall(fn)
```


