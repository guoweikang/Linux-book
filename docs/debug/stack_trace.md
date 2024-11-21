## Stack Trace

### 介绍

由于内核的堆栈大小是固定的，因此不要在函数中浪费堆栈是非常重要的。 内核开发人员必须注意在堆栈上分配的内容。 如果分配过多，系统就会面临堆栈溢出的危险，并发生损坏，通常会导致系统瘫痪。

有一些工具可以检查这一点，通常是通过中断定期检查使用情况。 但如果能在每次函数调用时都进行检查，就会变得非常有用。 由于`ftrace` 提供了一个函数跟踪器，因此可以方便地在每次函数调用时检查堆栈大小。 这可以通过`stack trace`实现

### How to Use

#### Enable

##### Boot

内核支持在`bootup` 阶段支持对某些函数`stack trace` ，通过如下选项

```vim
 stacktrace   [FTRACE]
               Enabled the stack tracer on boot up.

 stacktrace_filter=[function-list]
         、 [FTRACE] Limit the functions that the stack tracer
             will trace at boot up. function-list is a comma separated
             list of functions. This list can be changed at run
            time by the stack_trace_filter file in the debugfs
            tracing directory. Note, this enables stack tracing
            and the stacktrace above is not needed.
```

我们在 `available_filter_functions`找一个支持过滤我们感兴趣的函数

```
set bootargs = stacktrace_filter=uart_register_driver`
```

##### procfs

使能`stack tracer` 通过

```shell
echo 1 > /proc/sys/kernel/stack_tracer_enabled
```

#### statck_max_size

`stack trace` 会记录从开启`trace`使用最大栈大小的调用链

读取当前系统的最大栈大小

```shell
# cat stack_max_size
2928
```

也可以手动设置阈值，只有超过阈值的事件才会被跟踪

```shell
# echo  0  > stack_max_size  //重置
//记录超过1000的事件，是一个临时值，比如1001会，之后1001会继续被更大值覆盖
# echo  1000  > stack_max_size  
```

#### stack_trace

查看当前对应`stack_max_size`的栈记录日志

```vim
# cat stack_trace
        Depth    Size   Location    (18 entries)
        -----    ----   --------
  0)     2928     224   update_sd_lb_stats+0xbc/0x4ac
  1)     2704     160   find_busiest_group+0x31/0x1f1
  2)     2544     256   load_balance+0xd9/0x662
  3)     2288      80   idle_balance+0xbb/0x130
  4)     2208     128   __schedule+0x26e/0x5b9
  5)     2080      16   schedule+0x64/0x66
  6)     2064     128   schedule_timeout+0x34/0xe0
  7)     1936     112   wait_for_common+0x97/0xf1
  8)     1824      16   wait_for_completion+0x1d/0x1f
  9)     1808     128   flush_work+0xfe/0x119
 10)     1680      16   tty_flush_to_ldisc+0x1e/0x20
 11)     1664      48   input_available_p+0x1d/0x5c
 12)     1616      48   n_tty_poll+0x6d/0x134
 13)     1568      64   tty_poll+0x64/0x7f
 14)     1504     880   do_select+0x31e/0x511
 15)      624     400   core_sys_select+0x177/0x216
 16)      224      96   sys_select+0x91/0xb9
 17)      128     128   system_call_fastpath+0x16/0x1b
```

 

#### stack_trace_filter

`set_ftrace_filter`类似 , 支持`filter`和 `command`语法，参考`ftrace filter`

### How to implement

#### Register

`ftrace_ops` 如果没有特殊的使用要求，该函数的定义 简单到 只需要提供自己的回调函数实现，然后直接调用注册接口即可

```c
  static struct ftrace_ops trace_ops __read_mostly =
  { 
          .func = stack_trace_call,       
  };
  static __init int stack_trace_init(void)
  {
          int ret;

          ret = tracing_init_dentry();
          if (ret)
                  return 0;

          trace_create_file("stack_max_size", TRACE_MODE_WRITE, NULL,
                          &stack_trace_max_size, &stack_max_size_fops);

          trace_create_file("stack_trace", TRACE_MODE_READ, NULL,
                          NULL, &stack_trace_fops);
#ifdef CONFIG_DYNAMIC_FTRACE
          trace_create_file("stack_trace_filter", TRACE_MODE_WRITE, NULL,
                            &trace_ops, &stack_trace_filter_          if (stack_trace_filter_buf[0])
         ftrace_set_early_filter(&trace_ops, stack_trace_filter_buf, 1);
#endif
          if (stack_tracer_enabled)
                  register_ftrace_function(&trace_ops);

          return 0;
  }
```

#### stack_trace_call

该函数负责检查当前`fp frame`使用情况和`statck_max_size` 大小，决定是否需要回溯记录栈
