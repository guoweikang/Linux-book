## Obsolete Param

```json
"node" {
    "label": "obsolate param",
    "categories": ["config"],
    "info": "kernel obsolate param",
    "depends": [
          "kernel start",
          "boot config"
    ]
}
```

### 介绍

内核提供给各个模块注册参数接口，这些参数会在编译链接阶段存放在内核代码中，内核启动时 利用`command line` 和 这些注册的参数进行匹配，匹配成功，调用对应的设置回调函数，然后完成对应模块的配置

`obsolete param `是内核早期的版本，功能实现简单

### 内核实现

#### __setup_start 段

内核预留了一段代码段 ，被`.init.setup`标识的变量, 会被链接在` __setup_start `和`__setup_end`之间

```c
kernel$ grep __setup_start -r ./build_qemu/
./build_qemu/arch/arm64/kernel/vmlinux.lds:  
. = ALIGN(16);
 __setup_start = .; 
KEEP(*(.init.setup)) 
__setup_end = .;
```

#### struct  obs_kernel_param

参数的核心结构体

```c
  struct obs_kernel_param {
          //参数名称
          const char *str;
          //参数匹配回调设置函数
          int (*setup_func)(char *);
          // 区分是否为early 阶段
          int early;
  };
```

当参数匹配成功会 调用对应参数的回调函数

```c
int (*setup_func)(char *);
```

- `char *`: 对应参数设置的`value`的指针

- 返回值，`early = 0/1`的不同情况含义不同

#### API :__setup(str, fn)

此宏用于注册 `early=0`的 `obs_kernel_param`

```c
   #define __setup(str, fn)                                                \
          __setup_param(str, fn, fn, 0)
   #define __setup_param(str, unique_id, fn, early)                        \
          static const char __setup_str_##unique_id[] __initconst         \
                  __aligned(1) = str;                                     \
          static struct obs_kernel_param __setup_##unique_id              \
                  __used __section(".init.setup")                         \
                  __aligned(__alignof__(struct obs_kernel_param))         \
                  = { __setup_str_##unique_id, fn, early }
```

一个示例的展开

```c
#define __setup(test, test_set)
 static const char __setup_str_test  = "test";                                     \
  static struct obs_kernel_param __setup_test_set     
                  __used __section(".init.setup")                         \
                  = { __setup_str_test , test_set, 0}
```

 !!! note: 

    使用__setup设置参数，对应`early = 0`, 回调函数返回值为 1 表示成功处理 0表示没有处理成功

#### API :early_param(str, fn)

此宏用于注册 `early=1`的 `obs_kernel_param`

```c
  #define early_param(str, fn)                                            \
     __setup_param(str, fn, fn, 1)
```

#### !!! note:

```
使用early_param设置参数，对应`early = 1`
回调函数返回值为 0 表示成功处理 ，非0表示没有处理成功
```

#### parse_early_param

`early param`的解析 位于较早的时机

```c
start_kernel() 
 -> parse_early_param()
   -> parse_early_options()
     -> parse_args("early options", cmdline, NULL, 0, 0, 0, NULL,
              do_early_param);
       -> do_early_param()
         -> 遍历 __setup_start - __setup_end 
           -> 检查 early ==1 ? name 匹配成功？
            -> 匹配成功 执行 p->setup_func(val) 
```

```c
  static int __init do_early_param(char *param, char *val,
                                   const char *unused, void *arg)
  {
          const struct obs_kernel_param *p;

          for (p = __setup_start; p < __setup_end; p++) {
                  if ((p->early && parameq(param, p->str)) ||
                      (strcmp(param, "console") == 0 &&
                       strcmp(p->str, "earlycon") == 0)
                  ) {
                          if (p->setup_func(val) != 0)
                                  pr_warn("Malformed early option '%s'\n", param);
                  }
          }
          return 0;
  }
```

#### early == 0

我们还没有处理 `early = 0`的情况，实际上该选项的初始化 会在`parse_early_param  ` 处理完后，紧接着在 `bootoptions` 检查阶段被 `unknown_bootoption` 处理 

```c
start_kernel() {
    ... 
     parse_early_param();
     after_dashes = parse_args("Booting kernel",
                    static_command_line, __start___param,
                    __stop___param - __start___param,
                     -1, -1, NULL, &unknown_bootoption);
     print_unknown_bootoptions();

}

unknown_bootoption() 
   -> obsolete_checksetup()
     -> p->setup_func(val)
```

这段代码 引入了 `__stop___param`  我们下个小节在讲，现在不用关心

总结一下，`booting kernel`会对所有不支持的参数做检查 由于 `obs_kernel_param` 一定都不在`__stop___param` (在 `__setup_start`)，因此肯定会进入 `unknown_bootoption` 从而完成 回调函数调用

#### sample

early_param 示例： 0 表示成功

```c
static int __init parse_kpti(char *str)
{
          bool enabled;
          int ret = kstrtobool(str, &enabled);

          if (ret)
                  return ret;

          __kpti_forced = enabled ? 1 : -1;
          return 0;
}
early_param("kpti", parse_kpti);
```

`obsolete param` 实现功能简单，回调函数就是简单的回传字符串，字符串内容完全由模块自己定义

__setup 示例:  1 表示handled

```c
  force_gpt_fn(char *str)
  {
          force_gpt = 1;
          return 1;
  }
  __setup("gpt", force_gpt_fn);
```
