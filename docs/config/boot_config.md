## Boot config

```json
"node" {
    "label": "boot config",
    "categories": ["config"],
    "info": "kernel boot config",
    "depends": [
          "kernel start",
          "device tree",
          "rootfs"    
    ]
}
```

### 介绍

Linux 支持在启动阶段，利用`bootloader` 或者其他机制，完成对内核的初次配置

内核提供给各个模块注册参数接口，这些参数会在编译链接阶段存放在内核代码中，内核启动时 利用`command line` 和 这些注册的参数进行匹配，匹配成功，调用对应的设置回调函数，然后完成对应模块的配置

    !!! note

```
BOOT CONFIG 和 DEFCONFIG 的区别是什么? 一个是在代码编译阶段是否需要开启关闭某些
功能，一个是在运行启动阶段，决定是否开启某些功能
```

### 内核实现

内核提供了多种甚至是可以叠加的方法，给内核传递`boot config`,本小节将对这些方法统一介绍，我们以`arm64`作为参考

#### 核心变量

内核维护有关`command line`的几个核心变量如下，具体含义注释已经说明

```c
  /* Untouched command line saved by arch-specific code. */
  char __initdata boot_command_line[COMMAND_LINE_SIZE];
  /* Untouched saved command line (eg. for /proc) */
  char *saved_command_line __ro_after_init;
  unsigned int saved_command_line_len __ro_after_init;
  /* Command line for parameter parsing */
  static char *static_command_line;
  /* Untouched extra command line */
  static char *extra_command_line;
  /* Extra init arguments */
  static char *extra_init_args;
```

额外解释一下：

- boot_command_line ： 体系架构相关配置，比如`arm64` 该值等于 `CONFIG_CMDLINE` 和 `fdt bootargs`

- extra_command_line: `boog config file` 中 内核相关的配置项

- extra_init_args ： `boog config file`中传递给 `init` 进程 相关的配置项

- saved_command_line ： 包含 上面三个所有的参数

- static_command_line ： 除了 `extra_init_args`的参数总和，也就是只有`kernel` 关心的参数

#### init 流程

内核在`start_kernel`阶段完成 相关参数的初始化，有多个阶段

```c
start_kernel() 
  ...
 -> setup_arch(&command_line);
 -> setup_boot_config();
 -> setup_command_line(command_line);
```

接下来 针对这些过程进行剖析

#### From FDT

`arm64`架构下 `command_line = boot_command_lin`

```c
setup_arch(cmdline) 
 -> setup_machine_fdt()
    -> early_init_dt_scan()
      -> early_init_dt_scan_nodes() 
        -> early_init_dt_scan_chosen(boot_command_lin)
          -> boot_command_line=of_get_flat_dt_prop(node, "bootargs", &l);
```

上述流程第一次完成了 `boot_command_line`的初始化，初始化值使用设备树`bootargs`

#### From CONFIG_CMDLINE

内核也支持通过配置项`CONFIG_CMDLINE` 在编译阶段，定制`boot config`

代码依然位于 `early_init_dt_scan_chosen`,在扫描完 `bootargs`之后，继续执行

```c
  handle_cmdline:
          /*
           * CONFIG_CMDLINE is meant to be a default in case nothing else
           * managed to set the command line, unless CONFIG_CMDLINE_FORCE
           * is set in which case we override whatever was found earlier.
           */
  #ifdef CONFIG_CMDLINE
  #if defined(CONFIG_CMDLINE_EXTEND)
          strlcat(cmdline, " ", COMMAND_LINE_SIZE);
          strlcat(cmdline, CONFIG_CMDLINE, COMMAND_LINE_SIZE);
  #elif defined(CONFIG_CMDLINE_FORCE)
          strscpy(cmdline, CONFIG_CMDLINE, COMMAND_LINE_SIZE);
  #else
          /* No arguments from boot loader, use kernel's  cmdl*/
          if (!((char *)cmdline)[0])
                  strscpy(cmdline, CONFIG_CMDLINE, COMMAND_LINE_SIZE);
  #endif
  #endif /* CONFIG_CMDLINE */

          pr_debug("Command line is: %s\n", (char *)cmdline);
```

这里必须要针对不同配置项开启的行为做出解释

- `CONFIG_CMDLINE`: 只有内核配置了 `CONFIG_CMDLINE` 才会生效

- `CONFIG_CMDLINE_EXTEND`： `CONFIG_CMDLINE`作为额外的配置项 采取追加的方式，追加在 `bootargs`之后

- `CONFIG_CMDLINE_FORCE`: 强制使用`CONFIG_CMDLINE`,`bootargs`会被抹除

- 其他情况：只有在 `bootargs` 为空时，才使用 `CONFIG_CMDLINE`

#### From BOOT config file

内核还额外支持以文件的方式，把`bootconfig file`直接嵌入到 `initrd`或者`kernel image`, 此方法一般嵌入式场景很少使用， 详细使用参考[boot config](https://www.kernel.org/doc/Documentation/admin-guide/bootconfig.rst)

初始化核心代码

```c
setup_boot_config()
   /* Cut out the bootconfig data even if we have no bootconfig option */
    data = get_boot_config_from_initrd(&size);
  /* If there is no bootconfig in initrd, try embedded one. */
   if (!data)
     data = xbc_get_embedded_bootconfig(&size);

    // if set bootconfig, bootconfig_found = true
    err = parse_args("bootconfig", tmp_cmdline, NULL, 0, 0, 0, NULL,
         bootconfig_params);

    /* keys starting with "kernel." are passed via cmdline */
    extra_command_line = xbc_make_cmdline("kernel");
    /* Also, "init." keys are init arguments */
    extra_init_args = xbc_make_cmdline("init");
```

- `bootconfig` 自己额外表示一个选项，表示是否支持bootconfig file 功能（是否解析 bootconfig file 也可以在 由 bootconfig 控制 ）

- `CONFIG_BOOT_CONFIG_FORCE`： 不判断 `bootconfig`是否设置，默认认为需要解析

- 从 configfile 读取 `kernel`字段初始化 `extra_command_line`

- 从 configfile 读取 `init`字段初始化 `extra_init_args`

#### 参数汇总

核心逻辑在`setup_command_line` 这部分我们就不再看了 主要逻辑在上一节解释完了已经

#### 内核参数列表

内核参数列表： [The kernel command-line parameters](https://www.kernel.org/doc/html/v6.6/admin-guide/kernel-parameters.html)

官方文档列出来了所有内核支持的参数列表，可以作为查阅手册，

#### dmesg 查看

```shell
# dmesg |grep command
```

输出

```shell
~ # dmesg |grep command
[    0.000000] Kernel command line:  earlycon rdinit=/bin/sh
```

或者通过

```shell
# cat  /proc/cmdline
```

该文件会显示`saved_command_line`,也就是全部的内核参数列表

至此，有关`commandline`的设置方法以及初始化过程我们讲完了，下一节我们介绍 `param`的具体实现
