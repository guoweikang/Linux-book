## Ftrace

Linux 自`2.6.28`版本引入ftrace 功能

`Ftrace` 狭义上是指`Linux kernel Function Trace` ,但是实际上`linux` 已经更加完善和丰富了语义，通过对`trace func`功能集成完善，现在可以用于实现 **性能分析** **调度分析**等

Ftrace 是一种内部跟踪器，旨在帮助系统开发人员和设计人员了解内核内部的情况，可用于调试或分析用户空间以外的延迟和性能问题。

虽然 ftrace 通常被认为是函数跟踪器，但它实际上是多个不同跟踪工具的框架。 有延迟跟踪，可检查中断禁用和启用之间发生的情况，以及抢占和从任务唤醒到任务实际调度的时间。

ftrace 最常用的一种使用形式为`events tracing` ，再内核中，再各个模块有几百个静态事件的点，可以通过`tracefs` 使能使用

### 使用者视角

本小节，主要作为一个使用者, 学习如何利用`trace`功能进行内核开发定位，在 **开发者视角**章节中，探讨更多ftrace的实现细节

#### 术语

|        | 解释                                                          | 其他                       |
| ------ | ----------------------------------------------------------- | ------------------------ |
| tracer | Linux 对 `trace`进行了分类，有支持`函数调用关系`的tracer, 有`调度调优`的`tracer`等等 | 可以再Kconfig中 选择编译哪些tracer |
| events | 内核事件，参考`events.txt`                                         |                          |

![](image/7.png)

#### 内核配置

`Kconfig -> Tracers -> ` 根据需要 开启不同的`tracer`和功能

#### trace 文件系统

`trace fs`是一个非常重要的模块，使用者几乎都必须要通过`trace fs` 和 `ftrace`子系统进行交互(包括： 使能、配置、过滤、结果输出分析) 

Linux 内核通过 `tracefs` 文件系统，用来支持 `trace`功能的配置以及`trace`结果查询 挂载目录为 `/sys/kernel/tracing`

可以通过修改`/etc/fstab`

```shell
 tracefs /sys/kernel/tracing tracefs defaults 0 0`
```

或者 手动挂载

```shell
 mount -t tracefs nodev /sys/kernel/tracing
```

另外，`debugfs`系统中也集成了tracefs的自动挂载点，当`debugfs `文件系统挂载后，`tracefs`默认自动挂载在 `/sys/kernel/debug/tracing`

接下来tracefs内容做一些简单说明,

| 文件名                      | 功能说明                                                                                                              | 其他                                                                                                                                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| available_tracers        | 记录当前随内核编译并且注册到系统的 `tracer`                                                                                        | 在代码搜索`cs f c register_tracer` 可以看到有哪些`tracer`注册                                                                                                                                                                              |
| current_tracer           | 设置内核当前使用的`tracer`                                                                                                 | echo "xxx" > current_tracer 可以修改当前tracer，`nop`是个特殊的`tracer`，表示设置空`tracer`                                                                                                                                                    |
| tracing_on               | 关闭或开启日志输出                                                                                                         | 控制`tracer`输出，并不会真的注销`tracer`回调函数，因此`tracer`带来的系统调用开销还是存在的，要想关闭`tracer`，请设置`current_tracer` 为`nop`                                                                                                                            |
| trace                    | `tracing`结果输出文件，当文件被读取时，`tracing`动作期间停止                                                                           | 输出内容格式在不同`tracer`模式下 ，格式可能不同，具体解释参考  [输出格式](#标准Trace 输出格式)                                                                                                                                                                   |
| trace_pipe               | `pipe`日志可以被消费，日志读取后会阻塞等待新的内容                                                                                      | 和`trace`最大不同之处示工作模式，此文件不会阻塞`tracing`事件，此文件在trace阶段可以动态读取，实现动态分析，而`trace`是对过去阶段行为的解释                                                                                                                                          |
| trace_options            | 该文件可以控制输出文件中显示的数据格式。 还有一些选项可以修改`tracer`或`event`的工作方式（堆栈跟踪、时间戳等）                                                   | 比如`noxxx`表示 关闭某一列内容  详情参考 [Trace 选项](#Trace 选项)                                                                                                                                                                              |
| options                  | option的一个目录                                                                                                       | 详情参考 [Trace 选项](#Trace 选项)                                                                                                                                                                                                   |
| tracing_max_latency      | 某些`tracer`专门用于跟踪时延，比如`irqsoff`，这些值需要被记录在此文件中，单位 `ms`                                                              | 之所以没有在trace记录，该指标更像是一个`全局静态变量`, 在有新的值超过该值时 才需要被更新                                                                                                                                                                            |
| tracing_thresh           | 性能分析的tracer可能会用到，这是一个阈值(ms)，超过这个值的会被trace                                                                         | 要禁用`时延tracer`阈值功能，将该文件的值设置为 `0` （默认行为，记录最大的延迟日志）；否则表示开启，只有当延迟超过该设置的值，才会被记录                                                                                                                                                   |
| buffer_size_kb           | 用于设置或查看每个` CPU` 的跟踪缓冲区大小。它控制着内核为每个 CPU 分配的内存缓冲区大小，这些缓冲区用于存储`tracing data`。                                        | percpu 也有一份显示`per_cpu/cpu0/buffer_size_kb`；你可以通过向该文件写入一个数值来调整每个 CPU 的缓冲区大小。例如，设置每个 CPU 的缓冲区大小为 1024 KB：`echo 1024 > /sys/kernel/debug/tracing/buffer_size_kb`;在使用 `ftrace` 跟踪系统性能时，适当调整缓冲区大小可以帮助你捕获更多的数据，避免因缓冲区不足而丢失重要的跟踪信息。 |
| buffer_total_size_kb     | total of buffer_size_kb                                                                                           |                                                                                                                                                                                                                              |
| free_buffer              | 作为缓冲区释放的判断条件，当文件被关闭时(随打开进程退出一起)，缓冲区被自动释放                                                                          | 可以和 `disable_on_free` 选项配合使用 ， 如果`disable_on_free `选项也被设置为开启状态，那么在释放缓冲区的同时，`tracing`也会被自动停止                                                                                                                                  |
| tracing_cpumask          | 配置`tracing` 过滤的CPU 掩码                                                                                             | 只有指定`CPU`会被trace                                                                                                                                                                                                             |
| set_ftrace_filter        | 通过将 函数名 写入该文件，可以选择性跟踪某些函数                                                                                         | 结合`ftrace`功能实现原理，在动态追踪时，如果设置了过滤条件，则只会替换特定函数的 `mcount` trace实现，这样 系统开销可以降到极低，可以通过查看`available_filter_functions` 哪些函数支持trace                                                                                                   |
| set_ftrace_notrace       | 同上 但是是黑名单                                                                                                         | 同时存在与 黑白名单 ，按照黑名单处理                                                                                                                                                                                                          |
| set_ftrace_pid           | pid 白名单                                                                                                           | 如果 开启了 `function-fork`的 选项，则fork pid 也会被加入白名单                                                                                                                                                                                |
| set_event_pid            | event 白名单                                                                                                         |                                                                                                                                                                                                                              |
| set_graph_function       | graph func白名单                                                                                                     |                                                                                                                                                                                                                              |
| set_graph_notrace        | graph func黑名单                                                                                                     |                                                                                                                                                                                                                              |
| dyn_ftrace_total_info    |                                                                                                                   |                                                                                                                                                                                                                              |
| enabled_functions        | 主要用于调试 ftrace 功能，同时也可以帮助检查哪些函数已经绑定了回调（callback）。它展示了所有绑定了回调的函数以及每个函数绑定的回调数量。                                      | 这个文件可以帮助开发者调试回调函数的绑定情况以及查看每个函数的回调细节。                                                                                                                                                                                         |
| function_profile_enabled | 使能 trace 信息统计                                                                                                     | 使能后，可以在 trace_stats/function<cpu> ( function0, function1, etc). 查看所有追踪的函数在各个CPU上的统计信息(时间、次数)                                                                                                                                 |
| trace_stats              | trace 统计信息目录                                                                                                      | 可以用于性能调优(时间)和系统监控(次数)                                                                                                                                                                                                        |
| kprobe_events            | Enable dynamic trace points. See kprobetrace.txt.                                                                 | 在kprobe 章节单独讲解                                                                                                                                                                                                               |
| kprobe_profile           |                                                                                                                   |                                                                                                                                                                                                                              |
| max_graph_depth          | 用于 `function graph` tracer的追踪深度配置                                                                                 | 与函数图示跟踪器一起使用。 这是追踪函数的最大深度。 将其值设为 1 时，将只显示从用户空间调用的第一个内核函数。                                                                                                                                                                    |
| printk_formats           |                                                                                                                   | 适用于读取原始格式文件的工具。 如果环形缓冲区中的事件引用了字符串，缓冲区中记录的只是指向字符串的指针，而不是字符串本身。 这样，工具就无法知道该字符串是什么。该文件显示字符串和字符串的地址，允许工具将指针映射到字符串的内容                                                                                                             |
| saved_cmdlines           |                                                                                                                   |                                                                                                                                                                                                                              |
| saved_cmdlines_size      |                                                                                                                   |                                                                                                                                                                                                                              |
| saved_tgids              |                                                                                                                   |                                                                                                                                                                                                                              |
| snapshot                 | 这将显示 "快照 "缓冲区，并允许用户对当前运行的跟踪进行快照。                                                                                  | 更多详情，请参阅下文 "快照 "部分。                                                                                                                                                                                                          |
| stack_max_size:          | 激活堆栈跟踪器后，将显示遇到的最大堆栈大小。                                                                                            | 请参阅下面的 "堆栈跟踪 "部分。                                                                                                                                                                                                            |
| stack_trace              |                                                                                                                   | 这将显示激活堆栈跟踪器时遇到的最大堆栈的堆栈回溯跟踪。 请参阅下文 "堆栈跟踪 "部分。                                                                                                                                                                                 |
| stack_trace_filter       | 这与 "set_ftrace_filter "类似，但它限制了堆栈跟踪器将检查的函数。                                                                       |                                                                                                                                                                                                                              |
| trace_clock              | 每当一个事件被记录到环形缓冲区时，都会添加一个 "时间戳"。 时间戳来自指定的时钟。 默认情况下，ftrace 使用 `本地 时钟`。 该时钟非常快，而且严格按 CPU 设置，但在某些系统上，它与其他 CPU 的时钟可能不一致 | 被选择的时钟通过`[]`表示<br>支持的时钟类型有：<br> `local`:   CPU 本地时钟 可能不同CPU之间不相同 <br>`global`:   全局时钟 不同CPU之间相同, 慢一点 <br>`counter`:  这根本不是时钟，而是一个原子计数器。 它逐个计数，但与所有 CPU 同步。 如果需要准确了解不同 CPU 上事件发生的先后顺序，这一点非常有用 <br>                            |
| trace_marker             | 这是一个非常有用的文件，用于将用户空间与内核中发生的事件同步。 写入该文件的字符串将被写入ftrace 缓冲区。                                                          | 典型的比如andriod 利用了 该文件，实现了 `perfeto` 功能                                                                                                                                                                                        |
| trace_marker_raw         | 这与上面的 trace_marker 类似，但用于向其写入二进制数据，                                                                               | 可以使用工具解析 trace_pipe_raw 中的数据。                                                                                                                                                                                                |
| uprobe_events            | Add dynamic tracepoints in programs.                                                                              | See uprobetracer.txt                                                                                                                                                                                                         |
| uprobe_profile           | Uprobe statistics.                                                                                                | See uprobetrace.txt                                                                                                                                                                                                          |
| instances                | 这是一种创建多个跟踪缓冲区的方法，不同的事件可以记录在不同的缓冲区中。                                                                               | See "Instances" section below.                                                                                                                                                                                               |
| events                   | 这是跟踪事件目录。 它包含已编译到内核中的事件跟踪点（也称为静态跟踪点）。 它显示了存在哪些事件跟踪点，以及它们是如何按系统分组的。 不同级别的 "启用 "文件可以在写入 "1 "时启用跟踪点。                 | See events.txt for more information.                                                                                                                                                                                         |
| set_event                | 通过在该文件中呼应事件，将启用该事件。                                                                                               | See events.txt for more information.                                                                                                                                                                                         |
| available_events         |                                                                                                                   | 可在trace中启用的事件列表。                                                                                                                                                                                                             |
| hwlat_detector           | 硬件延迟检测器的目录。                                                                                                       |                                                                                                                                                                                                                              |
| per_cpu                  |                                                                                                                   | 这是一个包含 per_cpu 跟踪信息的目录。                                                                                                                                                                                                      |
| per_cpu/cpu0/stats:      | 这将显示有关环形缓冲区的某些统计信息                                                                                                |                                                                                                                                                                                                                              |

#### Tracer 介绍

下表统一的介绍了内核已有的一些`tracer `每一种`tracer`都有其专业和特殊的使用背景

我们将尽可能在后续章节给出使用方法和说明

| tracer name    | 功能说明                                                                                      | 其他                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| function       | 最基础的函数 trace                                                                              | 如果不设置过滤 默认所有可以trace的函数都会被trace                                                             |
| function_graph | 和`function` tracer 类似，只是函数跟踪器在函数进入时进行探测，而函数图跟踪器则在函数进入和退出时都进行探测。 然后，它就能绘制出类似于 C 代码源的函数调用图。 |                                                                                            |
| blk            | 块跟踪器。 blktrace 用户应用程序使用的跟踪器。                                                              |                                                                                            |
| hwlat          | 硬件延迟跟踪器用于检测硬件是否产生任何延迟。                                                                    | See "Hardware Latency Detector" section     below.                                         |
| irqsoff        | 跟踪禁用中断的区域，并保存最大延迟最长的跟踪。                                                                   | 参见 `tracing_max_latency` 记录新的最大值时，它将取代旧的跟踪。 配合 `latency-format` options使用， 选择跟踪器时会自动启用该选项。 |
| preemptoff     | 与 irqsoff 类似，但会跟踪和记录禁用抢占的时间。                                                              |                                                                                            |
| preemptirqsoff | 与 irqsoff 和 preemptoff 类似，但会跟踪和记录禁用 irq 和/或抢占的最长时间。                                       |                                                                                            |
| wakeup         | 跟踪并记录最高优先级任务被唤醒后获得调度所需的最大延迟时间。                                                            | 按照普通开发人员的预期跟踪所有任务。                                                                         |
| wakeup_rt      | 跟踪并记录仅 RT 任务（如的 `wakeup`）所需的最大延迟。 这对那些对 RT 任务的唤醒时序感兴趣的人很有用。                               |                                                                                            |
| wakeup_dl      | 跟踪并记录 SCHED_DEADLINE 任务被唤醒所需的最大延迟时间（与 "wakeup "和 "wakeup_rt "一样）。                         |                                                                                            |
| mmiotrace      | 用于跟踪二进制模块的特殊跟踪器，可跟踪模块对硬件的所有调用。 它还会跟踪模块从 I/O 中写入和读取的所有内容。                                  |                                                                                            |
| branch         | 在跟踪内核中的`likely/unlikely`调用时，可以配置该跟踪器。 它将跟踪可能和不可能的分支何时被命中，以及预测是否正确。                        |                                                                                            |
| nop            | 一个特殊的`tracer`                                                                             | 如果要移除所有`tracer` 只需要    `echo "nop" into                                                    |
| current_tracer |                                                                                           |                                                                                            |

#### Trace 输出格式

##### Trace 标准输出

在启用不同`tracer` 和设置不同的`trace options`，输出格式可能不完全相同，下面是一个典型的 `function tracer`的输出，这里我们先使能一个函数的trace

```bash
/sys/kernel/tracing # echo "do_nanosleep" > set_ftrace_filter
/sys/kernel/tracing # echo "function" > current_tracer
/sys/kernel/tracing # sleep 1 
/sys/kernel/tracing # cat trace
```

```vim
# tracer: function
#
# entries-in-buffer/entries-written: 15/15   #P:2
#
#                                _-----=> irqs-off/BH-disabled
#                               / _----=> need-resched
#                              | / _---=> hardirq/softirq
#                              || / _--=> preempt-depth
#                              ||| / _-=> migrate-disable
#                              |||| /     delay
#           TASK-PID     CPU#  |||||  TIMESTAMP  FUNCTION
#              | |         |   |||||     |         |
              sh-1       [000] ...1.   782.971505: do_nanosleep <-hrtimer_nanosleep
```

  对`trace`文件内容解释 ：

| 标题                                  | 说明                                                                                                                  | 其他                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `tracer`                            | 声明当前trace 展示的 `tracer`                                                                                              |                                |
| `entries-in-buffer/entries-written` | 显示缓冲区中的事件数和已写入条目的总数。 其中的差值就是由于缓冲区溢出而丢失的条目数（15- 15 = 0个丢失的事件）                                                        |                                |
| `P`                                 | 2 表示2个CPU 核心被追踪                                                                                                     |                                |
| `irqs-off/BH-disabled`              | `D`: 同时处于关中断 和 关闭下半部状态  <br>`d`：关中断状态 <br>`b`： 下半部关闭状态<br> `X`: 未开启中断状态追踪`TRACE_IRQFAGS_SUPPORT`<br>                |                                |
| `need-resched`                      | `B` :所有resched条件满足<br>`N` 1 3组合 <br>`L` 2 3 组合<br>`b`1 2 组合<br>`n`: 1<br>`l`：2<br>`p`:3                             | 三种`resched` 高优先级调度、延迟调度、抢占实时调度 |
| `hardirq/softirq`                   | `Z`: 处于nmi  硬中断上下文<br>`z`: 处于nmi上下文<br>`H`:处于中断上下文 (`softirq` & `hardirq`)<br>`h`: 硬中断上下文<br>`s`:软中断上下文<br>`b`: 下半部 |                                |
|                                     |                                                                                                                     |                                |

##### 时延Trace 输出格式

当启用了 `latency-format` 选项被启用 我们依然在上一个使用用例 使能

```shell
/sys/kernel/tracing # echo "do_nanosleep" > set_ftrace_filter
/sys/kernel/tracing # echo "function" > current_tracer
/sys/kernel/tracing # echo "1" > options/latency-format
/sys/kernel/tracing # sleep 1 
/sys/kernel/tracing # cat trace
```

```vim
# tracer: function
#
# function latency trace v1.1.5 on 6.6.7-rt18-00175-gd8aaa9fda659
# --------------------------------------------------------------------
# latency: 0 us, #2/2, CPU#1 | (M:preempt VP:0, KP:0, SP:0 HP:0 #P:2)
#    -----------------
#    | task: -0 (uid:0 nice:0 policy:0 rt_prio:0)
#    -----------------
#
#                    _------=> CPU#            
#                   / _-----=> irqs-off/BH-disabled
#                  | / _----=> need-resched    
#                  || / _---=> hardirq/softirq 
#                  ||| / _--=> preempt-depth   
#                  |||| / _-=> migrate-disable 
#                  ||||| /     delay           
#  cmd     pid     |||||| time  |   caller     
#     \   /        ||||||  \    |    /       
      sh-1         0...1. 3790741us$: do_nanosleep <-hrtimer_nanosleep
```

注意 这与之前的输出格式稍微有些差别： 可以看到 之前的输出是一个 `TIMESTAMP`  现在的`time`是相对于 `trace`开始后的一个时间 `delay`  则不以明显时间 而是通过一些符号 表示

- `$`表示大于1s

- `@` 大于100ms 

- `*` 大于10毫秒

- `#` 大于 1000 微妙

- `!`大于100微妙

- `+`大于10微妙

- 什么都没有  小于10微妙

启用`irq-off` 的tracer ，默认使能 `latency-format`

```shell
/sys/kernel/tracing # echo "do_nanosleep" > set_ftrace_filter
```

```vim
# tracer: irqsoff
#
# irqsoff latency trace v1.1.5 on 6.6.7-rt18-00175-gd8aaa9fda659
# --------------------------------------------------------------------
# latency: 674 us, #4/4, CPU#1 | (M:preempt VP:0, KP:0, SP:0 HP:0 #P:2)
#    -----------------
#    | task: top-113 (uid:0 nice:0 policy:0 rt_prio:0)
#    -----------------
#  => started at: _raw_spin_lock_irqsave
#  => ended at:   uart_write
#
#
#                    _------=> CPU#            
#                   / _-----=> irqs-off/BH-disabled
#                  | / _----=> need-resched    
#                  || / _---=> hardirq/softirq 
#                  ||| / _--=> preempt-depth   
#                  |||| / _-=> migrate-disable 
#                  ||||| /     delay           
#  cmd     pid     |||||| time  |   caller     
#     \   /        ||||||  \    |    /       
     top-113       1d....    1us!: trace_hardirqs_off <-_raw_spin_lock_irqsave
     top-113       1d..1.  670us : _raw_spin_unlock_irqrestore <-uart_write
     top-113       1d..1.  677us+: tracer_hardirqs_on <-uart_write
     top-113       1d..1.  689us : <stack trace>
 => uart_write
 => n_tty_write
 => file_tty_write.constprop.0
 => redirected_tty_write
 => vfs_write
 => ksys_write
 => __arm64_sys_write
 => invoke_syscall
 => el0_svc_common.constprop.0
 => do_el0_svc
 => el0_svc
 => el0t_64_sync_handler
 => el0t_64_sync
```

对于`时延敏感`的`tracer`,日志一般会保留时延最长的日志信息；另外可以通过`tracing_max_latency` 查看自`trace`最大时延

上面日志是`irqsoff`的一个输出示例，其中`raw_spin_lock_irqxxx` 中断开始关闭，

`uart` 中断开启，同时 给出了 详细的调用栈 可以用于分析

#### Trace 选项

`trace_options` 文件（或选项目录）用于控制在跟踪输出中打印的内容，或操作跟踪器。 要查看可用内容，只需 cat 该文件即可：

```vim
/sys/kernel/tracing # cat trace_options 
print-parent
nosym-offset
nosym-addr
noverbose
noraw
nohex
nobin
noblock
nofields
trace_printk
annotate
nouserstacktrace
nosym-userobj
noprintk-msg-only
context-info
latency-format
record-cmd
norecord-tgid
overwrite
nodisable_on_free
irq-info
markers
noevent-fork
nopause-on-trace
hash-ptr
function-trace
nofunction-fork
nodisplay-graph
nostacktrace
notest_nop_accept
notest_nop_refuse
```

如果希望关闭 某个选项，通过`no`前缀 

```shell
echo noprint-parent > trace_options
```

如果希望开启某个选项，去掉`no`前缀

```shell
echo sym-offset > trace_options
echo sym-addr > trace_options
```

| 选项              | 说明                                                                                                                                                                                                       | 其他     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| print-parent    | 在`function tracer`中打印 函数调用者                                                                                                                                                                              | 默认开启   |
| sym-offset      | 除了打印`function name`外，打印函数偏移信息` 0xb0/0x140` 表示函数大小为`0x140`，调用者位于 `0xb0`偏移                                                                                                                                 | 建议开启   |
| sym-addr        | 类似`sym-offset`显示具体的 地址信息                                                                                                                                                                                 | 建议开启   |
| verbose         | 当启用`latency-format`选项，会把时间显示为`top     125   1 1 00000000 00000000 [1a86f9c7c] 0.001ms (+0.730ms): trace_hardirqs_off+0x68/0x78 <ffffa69382feb560> <-_raw_spin_lock_irqsave+0x9c/0xa8 <ffffa693840d6414>` | 查看延时开启 |
| raw             | 这将显示原始数据。 该选项最适合与用户应用程序一起使用，因为用户应用程序可以更好地翻译原始数据，而不是在内核中进行翻译。                                                                                                                                             |        |
| hex             | 与raw类似，但数字将采用十六进制格式                                                                                                                                                                                      |        |
| bin             | 将以原始二进制格式打印                                                                                                                                                                                              |        |
| block           | 设置后，在轮询时读取 trace_pipe 将不会阻塞。                                                                                                                                                                             |        |
| trace_printk    | 可以禁止 trace_printk() 向缓冲区写入内容                                                                                                                                                                             |        |
| annotate        | 用来区分不同`CPU`缓冲区日志, 比如 当 某个`CPU `缓冲区最近发生了大量事件，导致前期占用了很多日志，而另一个 `CPU` 可能只发生了几个事件，因此它显示的事件时间较长。 在`trace`时，它会首先显示最旧的事件，看起来就像只有一个 CPU 运行（具有最旧事件的 CPU）。                                                         | 默认开启   |
| userstacktrac   | 记录当前用户空间线程的栈 在 `trace event`发生之后                                                                                                                                                                         |        |
| sym-userobj     | 配合`userstatktrace` 使用 ，会查找地址所属的对象，并打印相对地址。 这在 ASLR 启用时尤其有用，否则在应用程序停止运行后，就没有机会将地址解析为对象/文件/行了。                                                                                                             |        |
| printk-msg-only | 设置后，trace_printk()将只显示格式而不显示参数（如果使用 trace_bprintk() 或 trace_bputs() 保存了 trace_printk()）。                                                                                                                 |        |
| context-info    | 只显示事件数据。 隐藏通讯、PID、时间戳、CPU 和其他有用数据。                                                                                                                                                                       |        |
| latency-format  | 该选项可更改跟踪输出。 启用该选项后，跟踪会显示有关延迟的附加信息，如 "延迟跟踪格式 "中所述                                                                                                                                                         |        |
| record-cmd      | 启用任何事件或跟踪器时，sched_switch 跟踪点中都会启用一个钩子，用映射的 pids 和 comms 填充通讯缓存。 但这可能会造成一些开销，如果只关心 pids 而不关心任务名称，禁用该选项可以降低跟踪的影响。 请参阅 "saved_cmdlines                                                                      |        |
| record-tgid     | 启用任何事件或跟踪器时，都会在 sched_switch 跟踪点中启用钩子，以填充映射到 pids 的映射线程组 ID (TGID) 缓存。 请参见 "saved_tgids"。                                                                                                                |        |
| overwrite       | 该选项控制跟踪缓冲区满时的处理方式。 如果为 "1"（默认），则丢弃并覆盖最旧的事件。 如果为 "0"，则丢弃最新的事件（有关超限和丢弃的信息，请参阅 per_cpu/cpu0/stats                                                                                                           | 默认开启   |
| disable_on_free | 当 free_buffer 关闭时，将停止跟踪（tracing_on 设置为 0）。                                                                                                                                                               |        |
| irq-info        | 显示中断 抢占 resched 信息                                                                                                                                                                                       | 默认开启   |
| markers         | 设置后，trace_marker 可被写入（仅限 root）。 禁用后，trace_marker 在写入时会出现 EINVAL 错误。                                                                                                                                      |        |
| event-fork      | 设置后，在 set_event_pid 中列出 PID 的任务分叉时，其子任务的 PID 将被添加到 set_event_pid 中。 此外，当 PID 位于 set_event_pid 中的任务退出时，它们的 PID 也会从文件中删除。                                                                                  |        |
| function-trace  | 如果启用此选项（默认为启用），延迟跟踪器将启用函数跟踪。 禁用时，延迟跟踪器不跟踪函数。 这样就能在进行延迟测试时降低跟踪器的开销。                                                                                                                                       |        |
| function-fork   | 设置后，在 set_ftrace_pid 中列出 PID 的任务分叉时，其子任务的 PID 将被添加到 set_ftrace_pid 中。 此外，当 PID 位于 set_ftrace_pid 中的任务退出时，它们的 PID 也会从文件中删除                                                                                |        |
| display-graph   | 设置后，延迟跟踪器（irqsoff、唤醒等）将使用函数图跟踪，而不是函数跟踪。                                                                                                                                                                  |        |
| stacktrace      | 设置后，将在记录任何跟踪事件后记录堆栈跟踪。                                                                                                                                                                                   |        |
| branch          | 与跟踪器一起启用分支跟踪。 这将与当前设置的跟踪器一起启用分支跟踪。 使用 "nop "跟踪器启用分支跟踪器与只启用 "分支 "跟踪器是一样的。                                                                                                                                 |        |

##### 独属某个`tracer`的选项

| 选项                 | 说明                                                                                                  | 其他            | tracer         |
| ------------------ | --------------------------------------------------------------------------------------------------- | ------------- | -------------- |
| func_stack_trace   | 设置后，将在记录每个函数后记录堆栈跟踪。 注意！在启用此选项之前，请使用 `set_ftrace_filter `对记录的函数进行限制，否则系统性能将严重下降。 切记在清除功能过滤器之前禁用此选项。 | 配合白名单作函数追踪很有用 | function       |
| funcgraph-overrun  | 在函数图谱跟踪中，每个任务分配一个固定大小数组，记录调用图，当函数调用深度超过了数组大小深度，就会溢出；当这个参数启用，会额外记录函数调用深度是否超出了数组的限制                   | 建议开启          | function_graph |
| funcgraph-cpu      | 显示中间函数执行的CPU num                                                                                    | 建议开启          | function_graph |
| funcgraph-overhead | 设置后，如果功能执行时间超过一定量，则会显示延迟标记。 请参阅上文标题描述下的 `delay`。                                                    |               | function_graph |
| funcgraph-proc     | 与其他跟踪器不同的是，默认情况下不显示进程的命令行，而只在上下文切换时跟踪任务的进出。 启用该选项后，每一行都会显示每个进程的命令。                                  |               | function_graph |
| funcgraph-duration | 在每个函数结束时（返回），将以微秒为单位显示该函数的持续时间。                                                                     |               | function_graph |
| funcgraph-abstime  | 设置后，每一行都会显示时间戳                                                                                      | 默认关闭          | function_graph |
| funcgraph-irqs     | 禁用时，将不会跟踪中断内部发生的函数                                                                                  | 默认开启          | function_graph |
| funcgraph-tail     | 设置后，返回事件将包括它所代表的函数。 默认情况下是关闭的，函数返回时只显示结尾大括号"}"。                                                     |               | function_graph |
| sleep-time         | 运行函数图示跟踪器时，将任务调度的时间包含在其函数中。 启用后，将把任务调度的时间作为函数调用的一部分进行说明                                             | 性能分析<br> 默认开启 | function_graph |
| graph-time         | 在使用函数图示跟踪器运行函数剖析器时，包含调用嵌套函数的时间。 不设置此选项时，函数报告的时间将只包括函数本身的执行时间，而不包括函数调用的时间                            | 性能分析<br> 默认开启 | function_graph |
| blk_classic        |                                                                                                     |               | blk            |



#### Tracer: irqsoff

当中断被禁用时，`CPU` 无法对任何其他外部事件（`NMI `和 `SMI` 除外）做出反应。这会阻止定时器中断触发或鼠标中断让内核知道新的鼠标事件(类比)， 所以中断关闭的`时间长度` 是系统的`实时性`的一个重要指标 。



`irqsoff tracer`会跟踪中断被禁用的时间。每当达到一个新的最大延迟时，`tracer`会保存导致该延迟的跟踪，每次达到新的最大值时，旧的保存的跟踪都会被丢弃，而新的跟踪会被保存。



如果希望重置当前`最大时延` 设置 `tracing_max_latency = 0` ，下面是一个基本的`irqsoff tracer`使用方法



```shell
 # echo 0 > options/function-trace
 # echo irqsoff > current_tracer
 # echo 1 > tracing_on
 # echo 0 > tracing_max_late
 # ls -ltr
 # echo 0 > tracing_on
 # cat trace
```

得到输出

```vim
# tracer: irqsoff
#
# irqsoff latency trace v1.1.5 on 6.6.7-rt18-00175-gd8aaa9fda659
# --------------------------------------------------------------------
# latency: 999 us, #4/4, CPU#1 | (M:preempt VP:0, KP:0, SP:0 HP:0 #P:2)
#    -----------------
#    | task: ls-64 (uid:0 nice:0 policy:0 rt_prio:0)
#    -----------------
#  => started at: _raw_spin_lock_irqsave
#  => ended at:   uart_write
#
#
#                    _------=> CPU#            
#                   / _-----=> irqs-off/BH-disabled
#                  | / _----=> need-resched    
#                  || / _---=> hardirq/softirq 
#                  ||| / _--=> preempt-depth   
#                  |||| / _-=> migrate-disable 
#                  ||||| /     delay           
#  cmd     pid     |||||| time  |   caller     
#     \   /        ||||||  \    |    /       
      ls-64        1d....    1us!: trace_hardirqs_off <-_raw_spin_lock_irqsave
      ls-64        1d..1.  993us : _raw_spin_unlock_irqrestore <-uart_write
      ls-64        1d..1. 1002us : tracer_hardirqs_on <-uart_write
      ls-64        1d..1. 1011us : <stack trace>
 => uart_write
 => n_tty_write
 => file_tty_write.constprop.0
 => redirected_tty_write
 => vfs_write
 => ksys_write
 => __arm64_sys_write
 => invoke_syscall
 => el0_svc_common.constprop.0
 => do_el0_svc
 => el0_svc
 => el0t_64_sync_handler
 => el0t_64_sync

```

日志中可以看到   当前最大中断延迟为 `999 us`  从`_raw_spin_lock_irqsave`   开始，在`uart_write`结束 ， 实际显示的 时间 是`993-1 = 992us` 但是记录时间是`999us` 因为从记录比较最大时间和 实际记录函数时间中间，时间依然在递增，会有轻微误差。

上面日志我们关闭了 `function-trace`  如果开启 `function-trace` 我们可以看到更多的输出日志 ,输出了在这段期间的`function-trace` 日志和延迟时间



```vim
# tracer: irqsoff
#
# irqsoff latency trace v1.1.5 on 6.6.7-rt18-00175-gd8aaa9fda659
# --------------------------------------------------------------------
# latency: 1529 us, #143/143, CPU#1 | (M:preempt VP:0, KP:0, SP:0 HP:0 #P:2)
#    -----------------
#    | task: ls-65 (uid:0 nice:0 policy:0 rt_prio:0)
#    -----------------
#  => started at: _raw_spin_lock_irqsave
#  => ended at:   uart_write
#
#
#                    _------=> CPU#            
#                   / _-----=> irqs-off/BH-disabled
#                  | / _----=> need-resched    
#                  || / _---=> hardirq/softirq 
#                  ||| / _--=> preempt-depth   
#                  |||| / _-=> migrate-disable 
#                  ||||| /     delay           
#  cmd     pid     |||||| time  |   caller     
#     \   /        ||||||  \    |    /       
      ls-65        1d....    1us : trace_hardirqs_off <-_raw_spin_lock_irqsave
      ls-65        1d....    3us : preempt_count_add <-_raw_spin_lock_irqsave
      ls-65        1d..1.    6us : nbcon_acquire <-uart_write
      ls-65        1d..1.    8us : console_srcu_read_lock <-nbcon_acquire
      ls-65        1d..1.   10us : __srcu_read_lock <-console_srcu_read_lock
      ls-65        1d..1.   12us : console_srcu_read_unlock <-nbcon_acquire
      ls-65        1d..1.   14us : __srcu_read_unlock <-console_srcu_read_unlock
      ls-65        1d..1.   18us : __uart_start <-uart_write
      ls-65        1d..1.   21us : __pm_runtime_resume <-__uart_start
      ls-65        1d..1.   24us : _raw_spin_lock_irqsave <-__pm_runtime_resume
      ls-65        1d..1.   26us : preempt_count_add <-_raw_spin_lock_irqsave
      ls-65        1d..2.   28us : rpm_resume <-__pm_runtime_resume
      ls-65        1d..2.   31us : _raw_spin_unlock_irqrestore <-__pm_runtime_resume
      ls-65        1d..2.   33us : preempt_count_sub <-_raw_spin_unlock_irqrestore
      ls-65        1d..1.   37us : pl011_start_tx <-__uart_start
      ls-65        1d..1.   39us : pl011_tx_chars <-pl011_start_tx
      ls-65        1d..1.   41us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.   65us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.   82us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  106us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  120us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  135us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  150us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  164us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  179us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  194us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  208us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  223us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  238us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  253us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  268us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  283us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  298us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  313us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  328us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  343us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  358us : pl011_read <-pl011_tx_chars
      ls-65        1d..1.  364us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  378us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  393us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  408us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  423us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  437us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  452us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  467us : pl011_read <-pl011_tx_chars
      ls-65        1d..1.  474us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  494us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  508us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  524us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  539us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  553us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  568us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  583us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  598us : pl011_read <-pl011_tx_chars
      ls-65        1d..1.  605us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  621us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  636us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  650us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  665us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  680us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  695us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  710us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  725us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  740us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  754us : pl011_read <-pl011_tx_chars
      ls-65        1d..1.  763us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  777us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  792us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  807us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  821us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  836us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  851us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  865us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  880us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  894us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  910us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  925us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  940us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  954us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  969us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  984us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1.  999us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1. 1013us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1. 1028us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1. 1043us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1. 1059us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1. 1073us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1. 1088us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1. 1108us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1. 1124us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1. 1139us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1. 1154us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1. 1169us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1. 1189us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1. 1204us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1. 1219us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1. 1234us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1. 1249us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1. 1264us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1. 1279us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1. 1294us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1. 1309us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1. 1324us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1. 1339us+: pl011_read <-pl011_tx_chars
      ls-65        1d..1. 1369us : uart_write_wakeup <-pl011_tx_chars
      ls-65        1d..1. 1373us : tty_port_tty_wakeup <-uart_write_wakeup
      ls-65        1d..1. 1378us : tty_port_default_wakeup <-tty_port_tty_wakeup
      ls-65        1d..1. 1381us : tty_port_tty_get <-tty_port_default_wakeup
      ls-65        1d..1. 1385us : _raw_spin_lock_irqsave <-tty_port_tty_get
      ls-65        1d..1. 1389us : preempt_count_add <-_raw_spin_lock_irqsave
      ls-65        1d..2. 1392us : _raw_spin_unlock_irqrestore <-tty_port_tty_get
      ls-65        1d..2. 1396us : preempt_count_sub <-_raw_spin_unlock_irqrestore
      ls-65        1d..1. 1401us : tty_wakeup <-tty_port_default_wakeup
      ls-65        1d..1. 1405us : __wake_up <-tty_wakeup
      ls-65        1d..1. 1409us : __wake_up_common_lock <-__wake_up
      ls-65        1d..1. 1412us : _raw_spin_lock_irqsave <-__wake_up_common_lock
      ls-65        1d..1. 1416us : preempt_count_add <-_raw_spin_lock_irqsave
      ls-65        1d..2. 1419us : __wake_up_common <-__wake_up_common_lock
      ls-65        1d..2. 1424us : woken_wake_function <-__wake_up_common
      ls-65        1d..2. 1428us : default_wake_function <-woken_wake_function
      ls-65        1d..2. 1432us : try_to_wake_up <-default_wake_function
      ls-65        1d..2. 1436us : preempt_count_add <-try_to_wake_up
      ls-65        1d..3. 1440us : preempt_count_sub <-try_to_wake_up
      ls-65        1d..2. 1444us : _raw_spin_unlock_irqrestore <-__wake_up_common_lock
      ls-65        1d..2. 1448us : preempt_count_sub <-_raw_spin_unlock_irqrestore
      ls-65        1d..1. 1453us : tty_kref_put <-tty_port_default_wakeup
      ls-65        1d..1. 1458us : pl011_stop_tx <-pl011_tx_chars
      ls-65        1d..1. 1465us : arch_counter_read <-ktime_get_mono_fast_ns
      ls-65        1d..1. 1471us : __pm_runtime_suspend <-__uart_start
      ls-65        1d..1. 1475us : rpm_drop_usage_count <-__pm_runtime_suspend
      ls-65        1d..1. 1479us : _raw_spin_lock_irqsave <-__pm_runtime_suspend
      ls-65        1d..1. 1483us : preempt_count_add <-_raw_spin_lock_irqsave
      ls-65        1d..2. 1487us : rpm_suspend <-__pm_runtime_suspend
      ls-65        1d..2. 1491us : rpm_check_suspend_allowed <-rpm_suspend
      ls-65        1d..2. 1495us : __dev_pm_qos_resume_latency <-rpm_check_suspend_allowed
      ls-65        1d..2. 1499us : arch_counter_read <-ktime_get_mono_fast_ns
      ls-65        1d..2. 1506us : _raw_spin_unlock_irqrestore <-__pm_runtime_suspend
      ls-65        1d..2. 1510us : preempt_count_sub <-_raw_spin_unlock_irqrestore
      ls-65        1d..1. 1514us : nbcon_release <-uart_write
      ls-65        1d..1. 1518us+: _raw_spin_unlock_irqrestore <-uart_write
      ls-65        1d..1. 1529us : _raw_spin_unlock_irqrestore <-uart_write
      ls-65        1d..1. 1533us+: tracer_hardirqs_on <-uart_write
      ls-65        1d..1. 1544us : <stack trace>
 => uart_write
 => n_tty_write
 => file_tty_write.constprop.0
 => redirected_tty_write
 => vfs_write
 => ksys_write
 => __arm64_sys_write
 => invoke_syscall
 => el0_svc_common.constprop.0
 => do_el0_svc
 => el0_svc
 => el0t_64_sync_handler
 => el0t_64_sync

```



#### Tracer: preemptoff

 当抢占禁用时，我们可以接收中断，但任务无法被抢占，优先级较高的任务必须等待抢占再次启用后，才能抢占优先级较低的任务。因此抢占关闭的`时间长度` 也是系统的`实时性`的一个重要指标 。



preemptoff 跟踪器会跟踪禁用抢占的位置，与 `irqsoff tracer`一样，它也会记录禁用抢占的最大延迟。总体来说 他们俩非常相似。



```shell
 # echo 0 > options/function-trace
 # echo preemptoff > current_tracer
 # echo 1 > tracing_on
 # echo 0 > tracing_max_latency
 # ls -ltr
 [...]
 # echo 0 > tracing_on
 # cat trace
```



```vim
# tracer: preemptoff
#
# preemptoff latency trace v1.1.5 on 6.6.7-rt18-00175-gd8aaa9fda659
# --------------------------------------------------------------------
# latency: 1378 us, #4/4, CPU#1 | (M:preempt VP:0, KP:0, SP:0 HP:0 #P:2)
#    -----------------
#    | task: ls-70 (uid:0 nice:0 policy:0 rt_prio:0)
#    -----------------
#  => started at: uart_write
#  => ended at:   uart_write
#
#
#                    _------=> CPU#            
#                   / _-----=> irqs-off/BH-disabled
#                  | / _----=> need-resched    
#                  || / _---=> hardirq/softirq 
#                  ||| / _--=> preempt-depth   
#                  |||| / _-=> migrate-disable 
#                  ||||| /     delay           
#  cmd     pid     |||||| time  |   caller     
#     \   /        ||||||  \    |    /       
      ls-70        1d..1.    1us#: _raw_spin_lock_irqsave <-uart_write
      ls-70        1...1. 1368us+: _raw_spin_unlock_irqrestore <-uart_write
      ls-70        1...1. 1386us+: tracer_preempt_on <-uart_write
      ls-70        1...1. 1404us : <stack trace>
 => _raw_spin_unlock_irqrestore
 => uart_write
 => n_tty_write
 => file_tty_write.constprop.0
 => redirected_tty_write
 => vfs_write
 => ksys_write
 => __arm64_sys_write
 => invoke_syscall
 => el0_svc_common.constprop.0
 => do_el0_svc
 => el0_svc
 => el0t_64_sync_handler
 => el0t_64_sync

```



#### Tracer: preemptirqsoff

了解中断或抢占禁用时间最长的位置很有帮助。 但有时我们想知道何时禁用抢占或中断。

考虑如下代码



```c
    local_irq_disable();
    call_function_with_irqs_off();
    preempt_disable();
    call_function_with_irqs_and_preemption_off();
    local_irq_enable();
    call_function_with_preemption_off();
    preempt_enable();
```

`irqsoff` 将记录 `call_function_with_irqs_off()` 至 `call_function_with_irqs_and_preemption_off()` 的总长度。



`preemptoff` 将记录 `call_function_with_irqs_and_preemption_off` 

至`call_function_with_preemption_off` 的总长度 



但是我们可能需要记录 这两个时间总和 ， 需要用到`preemptirqsoff` ,分析下面的`trace`文件，观察其有意思的地方 



```vim
# tracer: preemptirqsoff
#
# preemptirqsoff latency trace v1.1.5 on 3.8.0-test+
# --------------------------------------------------------------------
# latency: 161 us, #339/339, CPU#3 | (M:preempt VP:0, KP:0, SP:0 HP:0 #P:4)
#    -----------------
#    | task: ls-2269 (uid:0 nice:0 policy:0 rt_prio:0)
#    -----------------
#  => started at: schedule
#  => ended at:   mutex_unlock
#
#
#                  _------=> CPU#            
#                 / _-----=> irqs-off        
#                | / _----=> need-resched    
#                || / _---=> hardirq/softirq 
#                ||| / _--=> preempt-depth   
#                |||| /     delay             
#  cmd     pid   ||||| time  |   caller      
#     \   /      |||||  \    |   /           
kworker/-59      3...1    0us : __schedule <-schedule
kworker/-59      3d..1    0us : rcu_preempt_qs <-rcu_note_context_switch
kworker/-59      3d..1    1us : add_preempt_count <-_raw_spin_lock_irq
kworker/-59      3d..2    1us : deactivate_task <-__schedule
kworker/-59      3d..2    1us : dequeue_task <-deactivate_task
kworker/-59      3d..2    2us : update_rq_clock <-dequeue_task
kworker/-59      3d..2    2us : dequeue_task_fair <-dequeue_task
kworker/-59      3d..2    2us : update_curr <-dequeue_task_fair
kworker/-59      3d..2    2us : update_min_vruntime <-update_curr
kworker/-59      3d..2    3us : cpuacct_charge <-update_curr
kworker/-59      3d..2    3us : __rcu_read_lock <-cpuacct_charge
kworker/-59      3d..2    3us : __rcu_read_unlock <-cpuacct_charge
kworker/-59      3d..2    3us : update_cfs_rq_blocked_load <-dequeue_task_fair
kworker/-59      3d..2    4us : clear_buddies <-dequeue_task_fair
kworker/-59      3d..2    4us : account_entity_dequeue <-dequeue_task_fair
kworker/-59      3d..2    4us : update_min_vruntime <-dequeue_task_fair
kworker/-59      3d..2    4us : update_cfs_shares <-dequeue_task_fair
kworker/-59      3d..2    5us : hrtick_update <-dequeue_task_fair
kworker/-59      3d..2    5us : wq_worker_sleeping <-__schedule
kworker/-59      3d..2    5us : kthread_data <-wq_worker_sleeping
kworker/-59      3d..2    5us : put_prev_task_fair <-__schedule
kworker/-59      3d..2    6us : pick_next_task_fair <-pick_next_task
kworker/-59      3d..2    6us : clear_buddies <-pick_next_task_fair
kworker/-59      3d..2    6us : set_next_entity <-pick_next_task_fair
kworker/-59      3d..2    6us : update_stats_wait_end <-set_next_entity
      ls-2269    3d..2    7us : finish_task_switch <-__schedule
      ls-2269    3d..2    7us : _raw_spin_unlock_irq <-finish_task_switch
      ls-2269    3d..2    8us : do_IRQ <-ret_from_intr
      ls-2269    3d..2    8us : irq_enter <-do_IRQ
      ls-2269    3d..2    8us : rcu_irq_enter <-irq_enter
      ls-2269    3d..2    9us : add_preempt_count <-irq_enter
      ls-2269    3d.h2    9us : exit_idle <-do_IRQ
[...]
      ls-2269    3d.h3   20us : sub_preempt_count <-_raw_spin_unlock
      ls-2269    3d.h2   20us : irq_exit <-do_IRQ
      ls-2269    3d.h2   21us : sub_preempt_count <-irq_exit
      ls-2269    3d..3   21us : do_softirq <-irq_exit
      ls-2269    3d..3   21us : __do_softirq <-call_softirq
      ls-2269    3d..3   21us+: __local_bh_disable <-__do_softirq
      ls-2269    3d.s4   29us : sub_preempt_count <-_local_bh_enable_ip
      ls-2269    3d.s5   29us : sub_preempt_count <-_local_bh_enable_ip
      ls-2269    3d.s5   31us : do_IRQ <-ret_from_intr
      ls-2269    3d.s5   31us : irq_enter <-do_IRQ
      ls-2269    3d.s5   31us : rcu_irq_enter <-irq_enter
[...]
      ls-2269    3d.s5   31us : rcu_irq_enter <-irq_enter
      ls-2269    3d.s5   32us : add_preempt_count <-irq_enter
      ls-2269    3d.H5   32us : exit_idle <-do_IRQ
      ls-2269    3d.H5   32us : handle_irq <-do_IRQ
      ls-2269    3d.H5   32us : irq_to_desc <-handle_irq
      ls-2269    3d.H5   33us : handle_fasteoi_irq <-handle_irq
[...]
      ls-2269    3d.s5  158us : _raw_spin_unlock_irqrestore <-rtl8139_poll
      ls-2269    3d.s3  158us : net_rps_action_and_irq_enable.isra.65 <-net_rx_action
      ls-2269    3d.s3  159us : __local_bh_enable <-__do_softirq
      ls-2269    3d.s3  159us : sub_preempt_count <-__local_bh_enable
      ls-2269    3d..3  159us : idle_cpu <-irq_exit
      ls-2269    3d..3  159us : rcu_irq_exit <-irq_exit
      ls-2269    3d..3  160us :  <-irq_exit
      ls-2269    3d...  161us : __mutex_unlock_slowpath <-mutex_unlock
      ls-2269    3d...  162us+: trace_hardirqs_on <-mutex_unlock
      ls-2269    3d...  186us : <stack trace>
 => __mutex_unlock_slowpath
 => mutex_unlock
 => process_output
 => n_tty_write
 => tty_write
 => vfs_write
 => sys_write
 => system_call_fastpath
```



#### Tracer: wakeup

人们对跟踪感兴趣的一种常见情况是唤醒任务实际唤醒所需的时间。 现在，对于非实时任务来说，这可能是任意的。 但跟踪它还是很有趣的。

不带 `function tracing` 的设置

```shell
 # echo 0 > options/function-trace
 # echo wakeup > current_tracer
 # echo 1 > tracing_on
 # echo 0 > tracing_max_latency
 # chrt -f 5 sleep 1
 # echo 0 > tracing_on
 # cat trace
```

跟踪器只跟踪系统中优先级最高的任务，以避免跟踪正常情况

非实时任务并不那么有趣。 更有趣的跟踪方法是只关注实时任务。



#### Tracer: wakeup_rt

在实时环境中，了解最高优先级任务从被唤醒到执行所需的唤醒时间非常重要。 这也被称为 `调度延迟`。 我要强调的是，这是指 RT 任务。 了解非 RT 任务的调度延迟也很重要，但平均调度延迟更适合非 RT 任务。 `LatencyTop` 等工具更适合此类测量。



实时环境关注的是最坏情况延迟。这是某事发生所需的最长延迟，而不是平均值。我们可以有一个非常快的调度程序，它可能只是偶尔会有较大的延迟，但这对实时任务来说不太好。`wakeup_rt` 跟踪器旨在记录 RT 任务的最坏情况唤醒。非 RT 任务没有被记录，因为跟踪器只记录一个最坏情况，而跟踪不可预测的非 RT 任务将覆盖 RT 任务的最坏情况延迟（只需运行正常的唤醒跟踪器一段时间即可看到这种效果）。



由于该跟踪器只处理 RT 任务，因此我们的运行方式将与之前的跟踪器略有不同。 我们将在 "chrt "下运行 "sleep 1"，以改变任务的优先级，而不是执行 "ls"。

```shell
 # echo 0 > options/function-trace
 # echo wakeup_rt > current_tracer
 # echo 1 > tracing_on
 # echo 0 > tracing_max_latency
 # chrt -f 5 sleep 1
 # echo 0 > tracing_on
 # cat trace
```

```vim
# tracer: wakeup_rt
#
# wakeup_rt latency trace v1.1.5 on 6.6.7-rt18-00175-gd8aaa9fda659
# --------------------------------------------------------------------
# latency: 248 us, #6/6, CPU#1 | (M:preempt VP:0, KP:0, SP:0 HP:0 #P:2)
#    -----------------
#    | task: sleep-164 (uid:0 nice:0 policy:1 rt_prio:5)
#    -----------------
#
#                    _------=> CPU#            
#                   / _-----=> irqs-off/BH-disabled
#                  | / _----=> need-resched    
#                  || / _---=> hardirq/softirq 
#                  ||| / _--=> preempt-depth   
#                  |||| / _-=> migrate-disable 
#                  ||||| /     delay           
#  cmd     pid     |||||| time  |   caller     
#     \   /        ||||||  \    |    /       
  <idle>-0         1dNh5.   16us+:        0:120:R   + [001]     164: 94:R sleep
  <idle>-0         1dNh5.   49us+: <stack trace>
 => __trace_stack
 => probe_wakeup
 => ttwu_do_activate.constprop.0
 => try_to_wake_up
 => wake_up_process
 => hrtimer_wakeup
 => __hrtimer_run_queues
 => hrtimer_interrupt
 => arch_timer_handler_virt
 => handle_percpu_devid_irq
 => generic_handle_domain_irq
 => gic_handle_irq
 => call_on_irq_stack
 => do_interrupt_handler
 => el1_interrupt
 => el1h_64_irq_handler
 => el1h_64_irq
 => default_idle_call
 => do_idle
 => cpu_startup_entry
 => secondary_start_kernel
 => __secondary_switched
  <idle>-0         1dNh5.   63us!: try_to_wake_up <-wake_up_process
  <idle>-0         1d..3.  228us : __schedule <-schedule_idle
  <idle>-0         1d..3.  236us :        0:120:R ==> [001]     164: 94:R sleep
  <idle>-0         1d..3.  244us : <stack trace>
 => __trace_stack
 => probe_wakeup_sched_switch
 => __schedule
 => schedule_idle
 => do_idle
 => cpu_startup_entry
 => secondary_start_kernel
 => __secondary_switched

```



请注意，记录的任务是 `sleep`，PID 为 `164`，rt_prio 为 `5`。 该优先级是用户空间优先级，而不是内核内部优先级。 `SCHED_FIFO` 的策略为 1，`SCHED_RR` 的策略为 2。

请注意，跟踪数据显示的是内部优先级`99 - rtprio`



使用 chrt -r 5 和函数跟踪设置进行同样的操作。

```shell
  echo 1 > options/function-trace
```



```vim
# tracer: wakeup_rt
#
# wakeup_rt latency trace v1.1.5 on 6.6.7-rt18-00175-gd8aaa9fda659
# --------------------------------------------------------------------
# latency: 874 us, #87/87, CPU#0 | (M:preempt VP:0, KP:0, SP:0 HP:0 #P:2)
#    -----------------
#    | task: sleep-167 (uid:0 nice:0 policy:1 rt_prio:5)
#    -----------------
#
#                    _------=> CPU#            
#                   / _-----=> irqs-off/BH-disabled
#                  | / _----=> need-resched    
#                  || / _---=> hardirq/softirq 
#                  ||| / _--=> preempt-depth   
#                  |||| / _-=> migrate-disable 
#                  ||||| /     delay           
#  cmd     pid     |||||| time  |   caller     
#     \   /        ||||||  \    |    /       
  <idle>-0         0dNh5.   14us!:        0:120:R   + [000]     167: 94:R sleep
  <idle>-0         0dNh5.  279us+: <stack trace>
 => __trace_stack
 => probe_wakeup
 => ttwu_do_activate.constprop.0
 => try_to_wake_up
 => wake_up_process
 => hrtimer_wakeup
 => __hrtimer_run_queues
 => hrtimer_interrupt
 => arch_timer_handler_virt
 => handle_percpu_devid_irq
 => generic_handle_domain_irq
 => gic_handle_irq
 => call_on_irq_stack
 => do_interrupt_handler
 => el1_interrupt
 => el1h_64_irq_handler
 => el1h_64_irq
 => default_idle_call
 => do_idle
 => cpu_startup_entry
 => rest_init
 => arch_call_rest_init
 => start_kernel
 => __primary_switched
  <idle>-0         0dNh5.  294us+: try_to_wake_up <-wake_up_process
  <idle>-0         0dNh4.  341us+: task_woken_rt <-ttwu_do_activate.constprop.0
  <idle>-0         0dNh4.  414us : _raw_spin_unlock <-try_to_wake_up
  <idle>-0         0dNh4.  417us : preempt_count_sub <-_raw_spin_unlock
  <idle>-0         0dNh3.  420us : _raw_spin_unlock_irqrestore <-try_to_wake_up
  <idle>-0         0dNh3.  423us : preempt_count_sub <-_raw_spin_unlock_irqrestore
  <idle>-0         0dNh2.  426us : preempt_count_sub <-try_to_wake_up
  <idle>-0         0dNh1.  431us : _raw_spin_lock_irq <-__hrtimer_run_queues
  <idle>-0         0dNh1.  434us : preempt_count_add <-_raw_spin_lock_irq
  <idle>-0         0dNh2.  438us : hrtimer_update_next_event <-hrtimer_interrupt
  <idle>-0         0dNh2.  441us : __hrtimer_next_event_base <-hrtimer_update_next_event
  <idle>-0         0dNh2.  443us : __hrtimer_next_event_base <-hrtimer_update_next_event
  <idle>-0         0dNh2.  447us : _raw_spin_unlock_irqrestore <-hrtimer_interrupt
  <idle>-0         0dNh2.  449us : preempt_count_sub <-_raw_spin_unlock_irqrestore
  <idle>-0         0dNh1.  452us : tick_program_event <-hrtimer_interrupt
  <idle>-0         0dNh1.  456us : clockevents_program_event <-tick_program_event
  <idle>-0         0dNh1.  459us : ktime_get <-clockevents_program_event
  <idle>-0         0dNh1.  462us : arch_counter_read <-ktime_get
  <idle>-0         0dNh1.  465us : arch_timer_set_next_event_virt <-clockevents_program_event
  <idle>-0         0dNh1.  472us : gic_eoi_irq <-handle_percpu_devid_irq
  <idle>-0         0dNh1.  481us : irq_exit_rcu <-el1_interrupt
  <idle>-0         0dNh1.  485us : irqtime_account_irq <-irq_exit_rcu
  <idle>-0         0dNh1.  488us : preempt_count_sub <-irq_exit_rcu
  <idle>-0         0dN.1.  491us+: idle_cpu <-irq_exit_rcu
  <idle>-0         0.N.1.  517us+: arch_cpu_idle_exit <-do_idle
  <idle>-0         0.N.1.  533us : tick_nohz_idle_exit <-do_idle
  <idle>-0         0dN.1.  541us : ktime_get <-tick_nohz_idle_exit
  <idle>-0         0dN.1.  544us : arch_counter_read <-ktime_get
  <idle>-0         0dN.1.  548us : tick_do_update_jiffies64 <-tick_nohz_idle_exit
  <idle>-0         0dN.1.  551us : _raw_spin_lock <-tick_do_update_jiffies64
  <idle>-0         0dN.1.  553us : preempt_count_add <-_raw_spin_lock
  <idle>-0         0dN.2.  557us : calc_global_load <-tick_do_update_jiffies64
  <idle>-0         0dN.2.  560us : _raw_spin_unlock <-tick_do_update_jiffies64
  <idle>-0         0dN.2.  563us : preempt_count_sub <-_raw_spin_unlock
  <idle>-0         0dN.1.  566us : update_wall_time <-tick_do_update_jiffies64
  <idle>-0         0dN.1.  569us : timekeeping_advance <-update_wall_time
  <idle>-0         0dN.1.  572us : _raw_spin_lock_irqsave <-timekeeping_advance
  <idle>-0         0dN.1.  576us : preempt_count_add <-_raw_spin_lock_irqsave
  <idle>-0         0dN.2.  579us : arch_counter_read <-timekeeping_advance
  <idle>-0         0dN.2.  583us : _raw_spin_unlock_irqrestore <-timekeeping_advance
  <idle>-0         0dN.2.  586us : preempt_count_sub <-_raw_spin_unlock_irqrestore
  <idle>-0         0dN.1.  590us : timer_clear_idle <-tick_nohz_idle_exit
  <idle>-0         0dN.1.  593us : calc_load_nohz_stop <-tick_nohz_idle_exit
  <idle>-0         0dN.1.  597us : tick_nohz_restart <-tick_nohz_idle_exit
  <idle>-0         0dN.1.  601us : hrtimer_cancel <-tick_nohz_restart
  <idle>-0         0dN.1.  605us+: hrtimer_try_to_cancel <-hrtimer_cancel
  <idle>-0         0dN.1.  619us : hrtimer_active <-hrtimer_try_to_cancel
  <idle>-0         0dN.1.  623us : _raw_spin_lock_irqsave <-hrtimer_try_to_cancel
  <idle>-0         0dN.1.  626us : preempt_count_add <-_raw_spin_lock_irqsave
  <idle>-0         0dN.2.  630us : __remove_hrtimer <-hrtimer_try_to_cancel
  <idle>-0         0dN.2.  636us : _raw_spin_unlock_irqrestore <-hrtimer_try_to_cancel
  <idle>-0         0dN.2.  639us : preempt_count_sub <-_raw_spin_unlock_irqrestore
  <idle>-0         0dN.1.  643us : hrtimer_forward <-tick_nohz_restart
  <idle>-0         0dN.1.  647us : hrtimer_start_range_ns <-tick_nohz_restart
  <idle>-0         0dN.1.  651us : _raw_spin_lock_irqsave <-hrtimer_start_range_ns
  <idle>-0         0dN.1.  654us : preempt_count_add <-_raw_spin_lock_irqsave
  <idle>-0         0dN.2.  657us : enqueue_hrtimer <-hrtimer_start_range_ns
  <idle>-0         0dN.2.  662us : hrtimer_reprogram.constprop.0 <-hrtimer_start_range_ns
  <idle>-0         0dN.2.  666us : tick_program_event <-hrtimer_reprogram.constprop.0
  <idle>-0         0dN.2.  669us : clockevents_program_event <-tick_program_event
  <idle>-0         0dN.2.  672us : ktime_get <-clockevents_program_event
  <idle>-0         0dN.2.  676us : arch_counter_read <-ktime_get
  <idle>-0         0dN.2.  682us+: arch_timer_set_next_event_virt <-clockevents_program_event
  <idle>-0         0dN.2.  704us+: _raw_spin_unlock_irqrestore <-hrtimer_start_range_ns
  <idle>-0         0dN.2.  734us : preempt_count_sub <-_raw_spin_unlock_irqrestore
  <idle>-0         0dN.1.  742us : account_idle_ticks <-tick_nohz_idle_exit
  <idle>-0         0dN.1.  746us : irqtime_account_process_tick <-account_idle_ticks
  <idle>-0         0dN.1.  751us : account_idle_time <-irqtime_account_process_tick
  <idle>-0         0.N.1.  761us : flush_smp_call_function_queue <-do_idle
  <idle>-0         0.N.1.  768us : schedule_idle <-do_idle
  <idle>-0         0dN.1.  776us : rcu_note_context_switch <-__schedule
  <idle>-0         0dN.1.  782us : rcu_qs <-rcu_note_context_switch
  <idle>-0         0dN.1.  788us : preempt_count_add <-__schedule
  <idle>-0         0dN.2.  792us : _raw_spin_lock <-__schedule
  <idle>-0         0dN.2.  795us : preempt_count_add <-_raw_spin_lock
  <idle>-0         0dN.3.  799us : preempt_count_sub <-__schedule
  <idle>-0         0dN.2.  805us : put_prev_task_idle <-__schedule
  <idle>-0         0dN.2.  811us : pick_next_task_stop <-__schedule
  <idle>-0         0dN.2.  816us : pick_next_task_dl <-__schedule
  <idle>-0         0dN.2.  820us : pick_next_task_rt <-__schedule
  <idle>-0         0dN.2.  824us : pick_task_rt <-pick_next_task_rt
  <idle>-0         0dN.2.  831us+: update_rt_rq_load_avg <-pick_next_task_rt
  <idle>-0         0d..3.  851us : __schedule <-schedule_idle
  <idle>-0         0d..3.  855us+:        0:120:R ==> [000]     167: 94:R sleep
  <idle>-0         0d..3.  869us : <stack trace>
 => __trace_stack
 => probe_wakeup_sched_switch
 => __schedule
 => schedule_idle
 => do_idle
 => cpu_startup_entry
 => rest_init
 => arch_call_rest_init
 => start_kernel
 => __primary_switched

```

即使启用了函数跟踪，跟踪的内容也不是很多，因此我将整个跟踪内容都包括在内。 中断是在系统空闲时发生的。在调用 `task_woken_rt`( 之前，NEED_RESCHED 标志被设置。 在调用 task_woken_rt()之前，NEED_RESCHED 标志被设置，第一次出现的 <mark>N </mark>标志表示了这一点。



#### Latency tracing and events

函数跟踪会导致更大的延迟，但如果看不到延迟内发生了什么，就很难知道是什么导致了延迟。 有一个中间方案，那就是启用事件。

```shell
# echo 0 > options/function-trace
 # echo wakeup_rt > current_tracer
 # echo 1 > events/enable
 # echo 1 > tracing_on
 # echo 0 > tracing_max_latency
 # chrt -f 5 sleep 1
 # echo 0 > tracing_on
 # cat trace
```



#### hwlat tracer

硬件延迟检测器通过启用 `hwlat `跟踪器来执行。此部分暂时跳过，软件开发者很少关注



<mark>注意，该跟踪器会影响系统性能，因为它会在禁用中断的情况下周期性地使 CPU 持续繁忙。</mark>

#### function tracer

这个跟踪器就是`function tracer`。 需要用户态开启 请参阅下面的 "ftrace_enabled "部分。

```shell
 # sysctl kernel.ftrace_enabled=1
 # echo function > current_tracer
 # echo 1 > tracing_on
 # usleep 1
 # echo 0 > tracing_on
 # cat trace
```

注意：功能跟踪器使用环形缓冲区来存储上述条目。 最新的数据可能会覆盖最旧的数据。 有时，使用 echo 来停止跟踪是不够的，因为跟踪可能已经覆盖了想要记录的数据。 因此，有时最好直接在程序中禁用跟踪。 这样就可以在遇到感兴趣的部分时停止跟踪。 要直接在 C 程序中禁用跟踪功能，可以使用下面的代码片段：



```c
int trace_fd;
[...]
int main(int argc, char *argv[]) {
	[...]
	trace_fd = open(tracing_file("tracing_on"), O_WRONLY);
	[...]
	if (condition_hit()) {
		write(trace_fd, "0", 1);
	}
	[...]
}
```



##### 任务线程追踪

通过设置  `pid`过滤选项(`set_ftrace_pid`)，可以轻易的实现 指定任务的 `function tracer`  

```shell
------
#!/bin/bash

tracefs=`sed -ne 's/^tracefs \(.*\) tracefs.*/\1/p' /proc/mounts`
echo nop > $tracefs/tracing/current_tracer
echo 0 > $tracefs/tracing/tracing_on
echo $$ > $tracefs/tracing/set_ftrace_pid
echo function > $tracefs/tracing/current_tracer
echo 1 > $tracefs/tracing/tracing_on
exec "$@"
------
```

使用该脚本

```shell
./trace_command.sh sleep 1
```



#### function graph tracer

该跟踪器与函数跟踪器类似，只是在函数进入和退出时对其进行探测。 这是通过在每个 `task_struct `中使用动态分配的返回地址栈来实现的。 在进入函数时，跟踪器会覆盖每个被跟踪函数的返回地址，以设置一个自定义探针。 因此，原始返回地址会存储在` task_struct `的返回地址堆栈中。

在函数两端进行探测可获得以下特殊功能： 

- 测量函数的执行时间 

- 拥有可靠的调用堆栈以绘制函数调用图



该跟踪器在以下几种情况下非常有用：

- 你想找到内核行为奇怪的原因，并需要查看在任何区域（或特定区域）发生的详细情况 

- 你遇到了奇怪的延迟，但很难找到其根源 

- 你想快速找到特定函数的路径 

- 你只是想窥探正在运行的内核，并想看看那里发生了什么。



```vim
# tracer: function_graph
#
# CPU  DURATION                  FUNCTION CALLS
# |     |   |                     |   |   |   |

 0)               |  sys_open() {
 0)               |    do_sys_open() {
 0)               |      getname() {
 0)               |        kmem_cache_alloc() {
 0)   1.382 us    |          __might_sleep();
 0)   2.478 us    |        }
 0)               |        strncpy_from_user() {
 0)               |          might_fault() {
 0)   1.389 us    |            __might_sleep();
 0)   2.553 us    |          }
 0)   3.807 us    |        }
 0)   7.876 us    |      }
 0)               |      alloc_fd() {
 0)   0.668 us    |        _spin_lock();
 0)   0.570 us    |        expand_files();
 0)   0.586 us    |        _spin_unlock();

```

有几个列可以动态启用/禁用。 可以根据自己的需要使用各种选项组合。



- 默认启用执行函数的 `CPU` 编号。 有时最好只跟踪一个 CPU（参见 `tracing_cpu_mask` 文件），否则在切换 CPU 跟踪时，有时可能会看到无序的函数调用。

- 持续时间（函数的执行时间）显示在函数的结尾括号行，如果是叶形函数，则显示在与当前函数相同的行上。 默认为启用。
- 在达到持续时间阈值的情况下，开销字段位于持续时间字段之前。



##### 函数过滤

函数过滤只有在动态ftrace 功能下可用， 

```shell
 # echo __do_fault > set_graph_function    // 跟踪哪些函数
 # echo '*preempt*' '*lock*' > set_ftrace_notrace   //不跟踪哪些函数
 # echo __do_fault >> set_graph_function    // 追加跟踪哪些函数

```

#### 其他过滤命令

`set_ftrace_filter` 接口支持一些命令。 跟踪命令的格式如下：

```shell
<function>:<command>:<parameter>
```

`mod` :该命令用于启用每个模块的函数筛选。 参数定义了模块。

例如，如果只需要 ext3 模块中的 write* 函数，则运行 

```shell
echo 'write*:mod:ext3' > set_ftrace_filter
```

该命令与过滤器的交互方式与根据函数名过滤的方式相同。 因此，在过滤器文件中添加 (>>) 就可以在不同模块中添加更多的函数。 删除特定模块的功能时，在前面加上"！"：

```shell
echo '!write*:mod:ext3' >> set_ftrace_filter //删除ext3模块的所有功能函数跟踪
echo '!*:mod:!ext3' >> set_ftrace_filter // 禁用除了EXT3模块的所有函数
echo '!*:mod:*' >> set_ftrace_filter // 禁用所有模块的跟踪，但仍跟踪内核：
echo '*write*:mod:!*' >> set_ftrace_filter // 只为内核设置函数过滤



```

`traceon/traceoff` :这些命令会在指定函数被触发时打开或关闭跟踪系统。 参数决定了跟踪系统开启和关闭的次数。 如果未指定，则没有限制。 例如，在`__schedule_bug`前5次禁用跟踪，请运行

```shell
echo '__schedule_bug:traceoff:5' > set_ftrace_filter
echo '__schedule_bug:traceoff' > set_ftrace_filter //当__schedule_bug 被触发时，始终禁用跟踪：

```

`snapshot` : 在触发该函数时触发快照。

```shell
echo 'native_flush_tlb_others:snapshot' > set_ftrace_filter


```

 `enable_event/disable_event` : 这些命令可以启用或禁用跟踪事件。 请注意，由于函数跟踪回调非常敏感，因此在注册这些命令时，跟踪点会被激活，但会以 "软 "模式禁用。 也就是说，跟踪点会被调用，但不会被跟踪。 只要有命令触发，事件跟踪点就会保持这种模式。

```
<function>:enable_event:<system>:<event>[:count]
<function>:disable_event:<system>:<event>[:count]
```

- **`<function>`**：需要跟踪的函数。
- **`enable_event` / `disable_event`**：指定启用或禁用的事件命令。
- **`<system>`**：事件所属的系统或子系统（如 `sched`、`irq` 等）。
- **`<event>`**：具体的事件名称（如 `sched_switch`、`try_to_wake_up` 等）。
- **`[:count]`**（可选）：指定命令生效的调用次数。



更多使用相关内容 请参考 [ftrace](https://www.kernel.org/doc/Documentation/trace/ftrace.txt)



### 开发者视角

#### pg 编译选项

ftrace 的实现原理还是非常简单的，这里以`arm架构`为例，就是在调用某个函数之前，先调用有关函数的`tracer func` ，如何实现？

先看一段最简单的代码, 主要是希望表达`main -> add` 这个调用关系

![](./image/3.png)

交叉编译反汇编可以得到很明确看到  main -> add` 这个调用关系

![](./image/4.png)

我们增加编译选项 `-pg`： 

```
-pg Generate extra code to write profile information suitable for the analysis program prof (for -p) or gprof (for -pg). You must use this option when compiling
the source files you want data about, and you must also use it when linking.
You can use the function attribute no_instrument_function to suppress profiling of individual functions when compiling with these options. See Section 6.33.1 [Common Function Attributes], page 600.
```

再看一下反汇编，可以观察到在每次发生函数调用地方之前，都会调用一个`__mcount` 函数(架构不同 可能命名不一样)

![](./image/5.png)

在用户态，`mcount` 主要是glibc 提供的`[glibc/sysdeps/arm/arm-mcount.S at master · lattera/glibc · GitHub](https://github.com/lattera/glibc/blob/master/sysdeps/arm/arm-mcount.S)`

mcount  函数可以通过栈回溯知道 整个调用链；并且可以进一步根据

不同函数需要trace的内容，记录trace 信息 

#### patchable-function-entry

考虑到性能，一般不会在所有函数调用的地方都调用`__mcount`，只要对应体系架构支持，Linux 默认 `__mcount` 其实都是空实现

Linux `arm64` 架构下 在开启动态没有使用`-pg` ，而是会直接使用

`-fpatchable-function-entry`

```
-fpatchable-function-entry=N[,M]
Generate N NOPs right at the beginning of each function, with the function
entry point before the Mth NOP. If M is omitted, it defaults to 0 so the function entry points to the address just at the first NOP. The NOP instructions
reserve extra space which can be used to patch in any desired instrumentation at run time, provided that the code segment is writable. The amount of
space is controllable indirectly via the number of NOPs; the NOP instruction
used corresponds to the instruction emitted by the internal GCC back-end interface gen_nop. This behavior is target-specific and may also depend on the
architecture variant and/or other compilation options.
For run-time identification, the starting addresses of these areas, which correspond to their respective function entries minus M, are additionally collected
in the __patchable_function_entries section of the resulting binary.
Note that the value of __attribute__ ((patchable_function_entry
(N,M))) takes precedence over command-line option -fpatchable-functionentry=N,M. This can be used to increase the area size or to remove it
completely on a single function. If N=0, no pad location is recorded.
The NOP instructions are inserted at—and maybe before, depending on M—
the function entry address, even before the prologue. On PowerPC with the
ELFv2 ABI, for a function with dual entry points, the local entry point is this
function entry address.
The maximum value of N and M is 65535. On PowerPC with the ELFv2 ABI,
for a function with dual entry points, the supported values for M are 0, 2, 6
and 14.
```

-fpatchable-function-entry=N[,M] 是一个 GCC 编译选项，用于在函数的开头预留空间以便在运行时进行插桩或修改。以下是这个选项的详细功能：

- 插入 NOP 指令： 这个选项指示编译器在每个函数的开头插入 N 条 NOP（No Operation）指令。NOP 是占位符指令，不影响程序执行，但会占用空间。这些空间可以在运行时插入自定义指令，前提是代码段可写。

- 函数入口点： 函数的入口点设置在第 M 个 NOP 之前。如果没有指定 M，则默认值为 0，这意味着入口点设置在 NOP 指令的最开始。这使得开发者可以精确控制函数开始执行的位置。

- 用途： 通过使用 NOP 预留空间，开发者可以在运行时对代码进行修改或插桩。这对于调试、性能分析或添加自定义插桩非常有用，而无需重新编译整个代码。

- __patchable_function_entries 段： 可修改区域的起始地址（函数入口减去 M）会被收集到生成的二进制文件中的一个特殊段，名为 __patchable_function_entries。这使得运行时系统或工具可以识别和利用这些可修改的位置。

- 属性优先级： 如果函数具有 **attribute**((patchable_function_entry(N,M))) 属性，它会优先于命令行选项 -fpatchable-function-entry=N,M。这允许对单个函数进行精细的控制，可以应用或禁用可修改的函数入口。

- PowerPC 上的双入口点： 在使用 ELFv2 ABI 的 PowerPC 架构上，对于具有双入口点的函数，入口点指的是本地入口点，并且 M 的支持值仅限于 0、2、6 和 14。

- 限制： N 和 M 的最大值为 65535。这限制了可以插入的 NOP 指令的数量以及函数入口点的位置。

这个选项特别适用于需要在编译后对函数进行修改或插桩的场景，使开发者可以在不重新编译源代码的情况下，在函数入口点插入自定义行为。

最后所有插桩的信息会存储在 段`__start_mcount_loc - __end_mcount_loc` 段中

```c
  #define MCOUNT_REC()    . = ALIGN(8);                           \
                          __start_mcount_loc = .;                 \
                          KEEP(*(__mcount_loc))                   \
                          KEEP_PATCHABLE                          \
                          __stop_mcount_loc = .;                  \
                          FTRACE_STUB_HACK                        \
                          ftrace_ops_list_func = arch_ftrace_ops_list_func;
  #else
  # ifdef CONFIG_FUNCTION_TRACER
  #  define MCOUNT_REC()  FTRACE_STUB_HACK                        \
                          ftrace_ops_list_func = arch_ftrace_ops_list_func;
  # else
  #  define MCOUNT_REC()
  # endif
  #endif
```

查看二进制插桩信息

```bash
$ aarch64-linux-gnu-objdump -h  ./build_qemu/kernel/groups.o    |grep __patchable_function_entries
4 __patchable_function_entries 00000060  0000000000000000  0000000000000000  000008a0  2**3
```

完成上述工作，我们可以得到以下内容： 

- 代码已经预留了可以存放插桩代码的空间

- 代码保存了 可以插桩的代码位置信息

基于这些信息，则可以实现动态插桩，在运行过程中，提供希望插桩

的位置和函数，内核找到对应位置，完成代码替换

#### 架构设计

tracers 代表不同的事件，事件可以有很多种类型，可以按需打开

我们在用一个图说明 模块间关系

![](image/6.png)

#### 注册流程分析

#### sysctl

`ftrace` 模块在`sysctl`  模块注册了 `kernel.ftrace_enabled` 可以支持上层用户关闭和开启  `ftrace` 功能, `sysctl` 机制不再这里讨论，我们主要看 `ftrace_enable_sysctl` 的动作 

```c
  static struct ctl_table ftrace_sysctls[] = {
          {
                  .procname       = "ftrace_enabled",
                  .data           = &ftrace_enabled,
                  .maxlen         = sizeof(int),  
                  .mode           = 0644,         
                  .proc_handler   = ftrace_enable_sysctl,
          },                   
          {}
  };

  static int __init ftrace_sysctl_init(void) 
  { 
          register_sysctl_init("kernel", ftrace_sysctls);
          return 0;            
  } 
  late_initcall(ftrace_sysctl_init);
```
