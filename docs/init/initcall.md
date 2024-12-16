## initcall机制

```json
"node" {
    "label": "initcall",
    "categories": ["init"],
    "info": "kernel initcall",
    "depends": [ 
        "kernel start"
    ]
}
```

### 代码段

内核在生成链接脚本时，会包含下列段

```c
__initcall_start = .;

KEEP(*(.initcallearly.init)) 
__initcall0_start = .; 
KEEP(*(.initcall0.init)) 
KEEP(*(.initcall0s.init)) 

__initcall1_start = .; 
KEEP(*(.initcall1.init)) 
KEEP(*(.initcall1s.init)) 

__initcall2_start = .;
KEEP(*(.initcall2.init)) 
KEEP(*(.initcall2s.init)) 

__initcall3_start = .; 
KEEP(*(.initcall3.init)) 
KEEP(*(.initcall3s.init)) 
__initcall4_start = .; 
KEEP(*(.initcall4.init)) 
KEEP(*(.initcall4s.init)) 

__initcall5_start = .; 
KEEP(*(.initcall5.init)) 
KEEP(*(.initcall5s.init))

__initcallrootfs_start = .; 
KEEP(*(.initcallrootfs.init))
KEEP(*(.initcallrootfss.init))

__initcall6_start = .; 
KEEP(*(.initcall6.init)) 
KEEP(*(.initcall6s.init)) 

__initcall7_start = .; 
KEEP(*(.initcall7.init)) 
KEEP(*(.initcall7s.init)) 
__initcall_end = .;
```

#### 函数link

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

可以通过上述宏声明具体的函数链接地址，则对应的函数指针在链接阶段会放在对应的段内存

#### array initcall_levels

系统初始化，对每个段分为如下几个等级

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

#### 初始化： do_initcalls

`do_initcalls ` 属于比较靠后的初始化，此时系统有依赖的核心功能已经初始化完成，开始子系统初始化 ,初始化调用的时机

```c
user thread: 
  kernel_init()
     -> kernel_init_freeable()
       -> do_basic_setup()
         -> do_initcalls()
```

```c
  static void __init do_initcalls(void)
  {       
          int level;
          size_t len = saved_command_line_len + 1;
          char *command_line;
          command_line = kzalloc(len, GFP_KERNEL);
          for (level = 0; level < ARRAY_SIZE(initcall_levels) - 1; level++) {
                  /* Parser modifies command_line, restore it each time */
                  strcpy(command_line, saved_command_line);
                  do_initcall_level(level, command_line);
          }
          kfree(command_line);
  }
```

就是按照`level`遍历调用各个初始化段的 初始化回调函数
