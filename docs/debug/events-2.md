## TRACE EVENTS

### 介绍

#### 回顾

回顾上一章节，`trace_points` 知识点：

- `static key`  对 某些固定场景的`branch miss` 优化 原理实现

- 如何使用 `DECLARE_TRACE` `DEFINE_TRACE` API 定义`tracepoints`

- 使用`register_trace_##name`注册回调函数 

- 源文件中使用`trace__##name`  显示添加`probe handler`

#### Trace Event 介绍

我们需要辩证的看

我们在`trace`系列中，其实已经见过一些基于`ftrace`实现的`tracer` ， 比如`stack tracer` 

`Event Trace`为不同`trace`事件提供

- `/sys/kernel/tracing/events` 的文件注册维护`enable/filter`等)

- `Trace Event` 的 `trace printk` 环形缓冲区的输出

- 基于日志内容字段的过滤 

- ...

不同

### 使用示例

需求定义:

内核中编增加一个`test_trace`模块 ，在/sys/kernel中创建一个文件，每当该文件被写入时，记录`trace`

#### 准备trace events

```c
guoweikang@ubuntu-virtual-machine:~/code/cicv/kernel$ cat include/trace/events/test_trace.h 
#undef TRACE_SYSTEM
#define TRACE_SYSTEM test_trace

#if !defined(_TRACE_TEST_H) || defined(TRACE_HEADER_MULTI_READ)
#define _TRACE_TEST_H

#include <linux/tracepoint.h>

TRACE_EVENT(test_store,
        TP_PROTO(int firstarg),

        TP_ARGS(firstarg),

    TP_STRUCT__entry(
        __field(    int,    val            )
    ),

    TP_fast_assign(
        __entry->val    = firstarg;
    ),

    TP_printk("test trace store val=%d",
        __entry->val
    )
);

#endif /* _TRACE_SUBSYS_H */

/* This part must be outside protection */
#include <trace/define_trace.h>
```

模块中使用

```c
#include <linux/init.h>
#include <linux/module.h>
#include <linux/kernel.h>
#include <linux/kobject.h>
#include <linux/sysfs.h>
#include <linux/fs.h>

#define CREATE_TRACE_POINTS
#include <trace/events/test_trace.h>
#undef CREATE_TRACE_POINTS

MODULE_LICENSE("GPL");
MODULE_AUTHOR("Guo Weikang");
MODULE_DESCRIPTION("A simple Linux kernel module to create a sysfs file.");
MODULE_VERSION("0.1");

static struct kobject *test_kobj;
static int test_value = 0;

// 读取文件时调用的函数
static ssize_t test_show(struct kobject *kobj, struct kobj_attribute *attr, char *buf)
{
    return sprintf(buf, "%d\n", test_value);
}

// 写入文件时调用的函数
static ssize_t test_store(struct kobject *kobj, struct kobj_attribute *attr, const char *buf, size_t count)
{
    sscanf(buf, "%du", &test_value);
    trace_test_store(test_value);
    return count;
}

// 创建一个 sysfs 文件，指定 show 和 store 函数
static struct kobj_attribute test_attribute = __ATTR(test, 0660, test_show, test_store);

// 模块初始化
static int __init test_init(void)
{
    int error = 0;

    // 在 /sys/kernel 下创建一个名为 test_module 的目录
    test_kobj = kobject_create_and_add("test_module", kernel_kobj);
    if (!test_kobj)
        return -ENOMEM;

    // 在 test_module 目录下创建 test 文件
    error = sysfs_create_file(test_kobj, &test_attribute.attr);
    if (error) {
        pr_debug("failed to create the test file in /sys/kernel/test_module\n");
    }

    pr_info("Test module loaded successfully.\n");
    return error;
}

// 模块卸载
static void __exit test_exit(void)
{
    // 删除 test 文件和 test_module 目录
    kobject_put(test_kobj);
    pr_info("Test module unloaded successfully.\n");
}

module_init(test_init);
module_exit(test_exit);
```

测试：

```shell
# echo 1 > /sys/kernel/tracing/events/test_trace/enable
# echo 1 > /sys/kernel/test_module/test
# echo 0 > /sys/kernel/test_module/test
```

可以看到：

```vim
# tracer: nop
#
# entries-in-buffer/entries-written: 2/2   #P:4
#
#                                _-----=> irqs-off/BH-disabled
#                               / _----=> need-resched
#                              | / _---=> hardirq/softirq
#                              || / _--=> preempt-depth
#                              ||| / _-=> migrate-disable
#                              |||| /     delay
#           TASK-PID     CPU#  |||||  TIMESTAMP  FUNCTION
#              | |         |   |||||     |         |
            bash-284     [002] .....  8311.766512: test_store: test trace store val=1
            bash-284     [002] .....  8314.316241: test_store: test trace store val=0
```

### Macro Use

#### TRACE_EVENT

`TRACE_EVENT` 就声明来说，和`DECLARE_TRACE` 类似 

```c
#undef TRACE_SYSTEM
#define TRACE_SYSTEM subsys

#if !defined(_TRACE_SUBSYS_H) || defined(TRACE_HEADER_MULTI_READ)
#define _TRACE_SUBSYS_H

#include <linux/tracepoint.h>

TRACE_EVENT(sched_switch,

    TP_PROTO(struct rq *rq, struct task_struct *prev,
         struct task_struct *next),

    TP_ARGS(rq, prev, next),

    TP_STRUCT__entry(
        __array(    char,    prev_comm,    TASK_COMM_LEN    )
        __field(    pid_t,    prev_pid            )
        __field(    int,    prev_prio            )
        __field(    long,    prev_state            )
        __array(    char,    next_comm,    TASK_COMM_LEN    )
        __field(    pid_t,    next_pid            )
        __field(    int,    next_prio            )
    ),

    TP_fast_assign(
        memcpy(__entry->next_comm, next->comm, TASK_COMM_LEN);
        __entry->prev_pid    = prev->pid;
        __entry->prev_prio    = prev->prio;
        __entry->prev_state    = prev->state;
        memcpy(__entry->prev_comm, prev->comm, TASK_COMM_LEN);
        __entry->next_pid    = next->pid;
        __entry->next_prio    = next->prio;
    ),

    TP_printk("prev_comm=%s prev_pid=%d prev_prio=%d prev_state=%s ==> next_comm=%s next_pid=%d next_prio=%d",
        __entry->prev_comm, __entry->prev_pid, __entry->prev_prio,
        __entry->prev_state ?
          __print_flags(__entry->prev_state, "|",
                { 1, "S"} , { 2, "D" }, { 4, "T" }, { 8, "t" },
                { 16, "Z" }, { 32, "X" }, { 64, "x" },
                { 128, "W" }) : "R",
        __entry->next_comm, __entry->next_pid, __entry->next_prio)
   );

/* This part must be outside protection */
#include <trace/define_trace.h>
```

`TRACE_EVENT` 额外增加了三个个参数，这三个参数，主要是用来 在`tracepoints`触发的时候，用于向`trace`缓冲区输出内容

- tstruct: 定义`printk`中准备使用的缓冲区的结构体类型

- assign: 定义结构体字段初始化过程，可以使用`args`中的参数初始化

- printk: 定义输出格式

在其他系统中定义和使用`trace_event` 

```c
#define CREATE_TRACE_POINTS
#include <trace/events/subsys.h>
#undef CREATE_TRACE_POINTS
```

#### 宏展开(重复包含)

实际上 `TRACE_EVENT`在展开时 会不停的重复包含原始的头文件，具体请看代码

第一次 `TRACE_EVENT` 定义

```c
//file: linux/tracepoint.h
#define TRACE_EVENT(name, proto, args, struct, assign, print)   \
```

第二次 `TRACE_EVENT` 定义 和 自包含

```c
// file: define_trace.h

#undef TRACE_EVENT 
#define TRACE_EVENT(name, proto, args, tstruct, assign, print)  \
           DEFINE_TRACE(name, PARAMS(proto), PARAMS(args))
#include TRACE_INCLUDE(TRACE_INCLUDE_FILE)
```

第三次 `TRACE_EVENT` 定义 和 自包含

```c
// file: trace_events.h
#define TRACE_EVENT(name, proto, args, tstruct, assign, print) \
       DECLARE_EVENT_CLASS(name,...
```

实际在`trace_events.h`还会有多次自包含展开

#### trace_events.h

我们还是沿着 上一个小节的 `TRACE_EVENT` 了解`trace_events.h`

```c
#define CREATE_TRACE_POINTS
#include "linux/tracepoints.h"  //第1次 定义了TRACE_EVENT  = DECLARE_TRACE
TRACE_EVENT() //第一次展开为 DECLARE_TRACE 
#include "define_trace.h" //第2次 定义了TRACE_EVENT  = DEFINE_TRACE
TRACE_EVENT() //第2次展开为 DEFINE_TRACE
#include <trace/trace_events.h> //第3次定义 DECLARE_EVENT_CLASS + DEFINE_EVENT
 TRACE_EVENT() //展开为: DECLARE_EVENT_CLASS DEFINE_EVENT
 struct trace_event_raw_##name {                                 \
                  struct trace_entry      ent;                            \
                  tstruct                                                 \
                  char                    __data[];                       \
 };                                                              \

static struct trace_event_class event_class_##name;
static struct trace_event_call  __used  event_##name；
#include <trace/trace_events.h> //第4次定义 DECLARE_EVENT_CLASS + DEFINE_EVENT
TRACE_EVENT() 
 struct trace_event_data_offsets_##call {                        \
                  tstruct;                                                \
  };
#include <trace/trace_events.h> //第5次定义 DECLARE_EVENT_CLASS + DEFINE_EVENT
static notrace enum print_line_t                                        \
trace_raw_output_##call(struct trace_iterator *iter, int flags,         \
                        struct trace_event *trace_event) 
static struct trace_event_functions trace_event_type_funcs_##call = {   \
          .trace                  = trace_raw_output_##call,              \
};
 #undef CRCREATE_TRACE_POINTS
```

不管如何，最终会有一个 `trace_events` 被放在 `section _ftrace_events`

```c
  static struct trace_event_call __used                                   \

  __section("_ftrace_events") *__event_##call = &event_##call
```

### Event 高级使用方法

参考`samples/trace_events.c/.h`

此代码完整提供了不同情况下的`TRACE_EVENT`的使用

#### 高级结构体参数定义

- `__print_symbolic` 的使用：支持类似enum to string 的转换

- `__print_flags`的使用：支持bit test  to string 

- `__dynamic_array`：动态数组定义

- `__print_array`： 动态数组打印

- ...其他动态数组 `vstr` `string` 等的定义和打印使用

#### TRACE_EVENT_CONDITION

支持静态过滤选项，和`TRACE_EVENT` 几乎一样

```c
TRACE_EVENT_CONDITION(name, proto, args, cond, struct, assign, printk)
```

#### TRACE_EVENT_FN

额外支持两个函数指针`reg/unreg`，在`EVENT` disable 和 enable的时候调用 

#### DECLARE_EVENT_CLASS

`EVENT CLASS`参考 下面链接，讨论了如何通过`DECLARE_EVENT_CLASS`节省代码空间

[Using the TRACE_EVENT() macro (Part 2) [LWN.net]](https://lwn.net/Articles/381064/)

#### 跨不同源文件使用trace

只允许一个源文件 同时定义`CREATE_TRACE_POINTS` 并且 `include "subsys.h"`

其他源文件如果希望使用，只需要 `include subsys.h`

### Event: tracefs

#### Enable

##### set_event

可用于跟踪的事件可在`/sys/kernel/debug/tracing/available_events` 文件中找到。

```shell
# cat  /sys/kernel/debug/tracing/available_events
```

本质上就是遍历`top trace_array`中 `events`(event_file) ，注册位于`trace_create_new_event`

如果想要使能某个`event`

```shell
# echo sched_wakeup >> /sys/kernel/debug/tracing/set_event
```

注意：这里一定要使用`>>`否则，如果使用`>`行为会是先清空所有使能的`events`然后再使能

```c
  static int
  ftrace_event_set_open(struct inode *inode, struct file *file)
  { 
   ...
          if ((file->f_mode & FMODE_WRITE) &&
              (file->f_flags & O_TRUNC))      
                  ftrace_clear_events(tr);  
  ...
  }
```

如果关闭某个event `使用`

```shell
# echo ‘！sched_wakeup’ >> /sys/kernel/debug/tracing/set_event
```

使能或者关闭 某个 `subsys`的events

```shell
# echo 'irq:*' > /sys/kernel/debug/tracing/set_event
```

##### enable toggle

每个`event` 也都有自己的`disable/enable`接口

```shell
# echo 0 > /sys/kernel/debug/tracing/events/sched/sched_wakeup/enable
# echo 1 > /sys/kernel/debug/tracing/events/sched/sched_wakeup/enable
```

##### boot

再启动阶段开启调试

```shell
trace_event=[event-list]
```

#### Event Formats

每个跟踪事件都有一个与之关联的 `format`文件，其中包含对记录事件中每个字段的描述。 这些信息可用于解析二进制跟踪流，也可用于查找事件过滤器中使用的字段名称。

它还会显示用于以文本模式打印事件的格式字符串，以及事件名称和用于剖析的 ID。

每个事件都有一组与之相关的通用字段；这些字段就是以 `common_ `为前缀的字段。 其他字段因事件而异，并与该事件的` TRACE_EVENT `定义中定义的字段相对应。

```c
field:field-type field-name; offset:N; size:N;
```

其中，offset 是跟踪记录中字段的偏移量，size 是数据项的大小（以字节为单位）。

例如，这里显示的是 `test_store`事件的信息：

```vim
name: test_store
ID: 220
format:
    field:unsigned short common_type;    offset:0;    size:2;    signed:0;
    field:unsigned char common_flags;    offset:2;    size:1;    signed:0;
    field:unsigned char common_preempt_count;    offset:3;    size:1;    signed:0;
    field:int common_pid;    offset:4;    size:4;    signed:1;

    field:int val;    offset:8;    size:4;    signed:1;

print fmt: "test trace store val=%d", REC->val
```

表示

- 有四个公共的内容`common_`

- 有1个属于event 独有的`val`

#### Trace filed filter

在内核中，跟踪事件可以通过布尔 **过滤表达式**进行过滤。 一旦事件被记录到跟踪缓冲区，就会根据与该事件类型关联的过滤表达式检查其字段。 字段值 "匹配 "过滤器的事件将出现在跟踪输出中，而值不匹配的事件将被丢弃。 没有与过滤器相关联的事件会匹配所有内容，这是未为事件设置过滤器时的默认设置。

##### Expression syntax

过滤表达式由一个或多个 "谓词 "组成，可使用逻辑运算符"&&"和"||"进行组合。 谓词只是一个子句，它将记录事件中包含的字段值与常量值进行比较，并根据字段值是否匹配或不匹配返回 0 或 1：

```shell
field-name relational-operator value
```

括号可用于提供任意逻辑分组，双引号可用于防止 shell 将操作符解释为 shell 元字符。

数字字段可用的运算符有: `==, !=, <, <=, >, >=, &`

字符串可以使用的: `==, !=, ~` 其中`~`接收通配符号`* ?` 

```vim
prev_comm ~ "*sh"
prev_comm ~ "sh*"
prev_comm ~ "*sh*"
prev_comm ~ "ba*sh"
```

如果字段是指向用户空间的指针（例如 `sys_enter_openat` 中的 `filename`），则必须在字段名后加上".ustring"：

```vim
filename.ustring ~ "password"
```

因为内核必须知道如何从用户空间获取指针所在的内存。

##### Setting filters

通过向给定`event`的 `filter`文件写入过滤器表达式，可为单个`event`设置过滤器。

```shell
# cd /sys/kernel/debug/tracing/events/test/test_store
# echo "val > 4" > filter
```

一个稍微复杂一点的例子：

```shell
# cd /sys/kernel/debug/tracing/events/signal/signal_generate
# echo "((sig >= 10 && sig < 15) || sig == 17) && comm != bash" > filter
```

如果表达式中存在错误，则在设置时会出现 "无效参数 "错误，通过查看过滤器可以看到错误字符串和错误信息，例如:

```shell
# cd /sys/kernel/debug/tracing/events/signal/signal_generate
# echo "((sig >= 10 && sig < 15) || dsig == 17) && comm != bash" > filter
-bash: echo: write error: Invalid argument
# cat filter
((sig >= 10 && sig < 15) || dsig == 17) && comm != bash
^
parse_error: Field not found
```

目前，表示错误的刻度线`^`总是出现在过滤器字符串的开头；即使没有更准确的位置信息，错误信息仍然有用。

##### filter limitations

如果在字符串指针`char *`上设置了过滤器，而该指针并不指向环形缓冲区上的字符串，而是指向内核或用户空间的内存，那么出于安全考虑，最多会将 1024 字节的内容复制到临时缓冲区中进行比较。 如果内存拷贝出现错误（指针指向不应访问的内存），那么字符串比较将被视为不匹配。

##### clearing filter

要清除某个事件的过滤器，请在该事件的过滤器文件中写入 `0`。 要清除某个子系统中所有事件的过滤器，请在该子系统的过滤器文件中写入 `0`。

##### subsys filter

为方便起见，可将子系统中每个事件的过滤器作为一组进行设置或清除，方法是将过滤器表达式写入子系统根目录下的过滤器文件。 但需要注意的是，如果子系统中任何事件的过滤器缺少子系统过滤器中指定的字段，或者由于其他原因无法应用过滤器，则该事件的过滤器将保留其先前的设置。 这可能会造成过滤器的意外混合，从而导致混乱的跟踪输出（用户可能会认为不同的过滤器在起作用）。 只有只引用通用字段的过滤器才能保证成功传播到所有事件。

下面是几个子系统过滤器的例子，也能说明上述问题：

清除子系统中所有事件的筛选器：

```shell
# cd /sys/kernel/debug/tracing/events/sched
# echo 0 > filter
# cat sched_switch/filter
none
# cat sched_wakeup/filter
none
```

为子系统中的所有事件设置过滤器，过滤器只使用通用字段（所有事件最终使用相同的过滤器）：

```shell
# cd /sys/kernel/debug/tracing/events/sched
# echo common_pid == 0 > filter
# cat sched_switch/filter
common_pid == 0
# cat sched_wakeup/filter
common_pid == 0
```

尝试使用非通用字段为调度子系统中的所有事件设置过滤器（除具有 prev_pid 字段的事件外，所有事件均保留其原有过滤器）：

```shell
# cd /sys/kernel/debug/tracing/events/sched
# echo prev_pid == 0 > filter
# cat sched_switch/filter
prev_pid == 0
# cat sched_wakeup/filter
common_pid == 0
```

#### PID filter

在与顶层事件目录相同的目录中，`set_event_pid` 文件将过滤所有事件，不跟踪任何没有在 `set_event_pid `文件中列出 PID 的任务。

```shell
# cd /sys/kernel/debug/tracing
# echo $$ > set_event_pid
# echo 1 > events/enable
```

只跟踪当前任务的事件。

要添加更多 PID 而不丢失已包含的 PID，请使用`>>`

```shell
# echo 123 244 1 >> set_event_pid
```

### Event triggers

本小节我们围绕`trigger commands`展开 

跟踪事件可以有条件地调用触发器 `commands`，触发器 `commands`有多种形式，例如可以：

- 启用或禁用其他跟踪事件

- 当跟踪事件被触发时调用堆栈跟踪

每当调用附带触发器的跟踪事件时，就会调用与该事件相关的触发器命令集。 

任何给定的`trigger`都可以附加一个`event filter`： 只有当`event`通过了`filter`，`command`才会被调用。 如果`trigger`没有关联`filter`，则总是通过。

通过将触发表达式写入给定事件的 `trigger`文件，可以在特定事件中添加或删除触发器。

某个`event`可以有任意数量的`trigger`与之相关联，但须遵守个别`command`在这方面可能有的限制。

`event trigger`是在 `soft`模式基础上实现的，这意味着只要`event`有一个或多个`trigger`与之关联，即使`event`实际上`disable`，也会被`active`，但在 `soft`模式下`disable`。 也就是说，`trace event`会被调用，但不会被`trace`，除非它真的被启用。 这种方案允许即使是未启用的`event`也能调用`trigger`，还允许使用当前的事件过滤器实现有条件地调用触发器。

事件触发器的语法大致基于 `set_ftrace_filter ` 中 `ftrace` 过滤器命令 "的语法，但两者之间存在很大差异，而且目前的实现方式与之并无任何关联，因此请注意不要将两者混为一谈。

#### 表达式语法

添加`command`

```shell
# echo 'command[:count] [if filter]' > trigger
```

移除 `command`

```shell
# echo '!command[:count] [if filter]' > trigger
```

删除时，`[if filter] `部分不会在匹配命令中使用，因此在`！`命令中不使用该部分与使用该部分的效果是一样的。

过滤语法与上文 `event filter`"部分所述相同。

为了方便使用，目前使用`>`写入触发器文件只是添加或删除单个触发器，没有明确的">>"支持（">"的行为实际上与">>"类似），也没有删除所有触发器的截断支持（每添加一个触发器都必须使用"！"）。

#### command: disable/enable_event

只要`event`被触发，就能启用或禁用另一个`event`。 

例如，下面的触发器会在`sys_enter_read`调用时跟踪 `kmalloc `事件，末尾的 :1 则指定这种启用只发生一次：

```
# echo 'enable_event:kmem:kmalloc:1' > \
    /sys/kernel/debug/tracing/events/syscalls/sys_enter_read/trigger
```

以下触发器会导致在读取系统调用退出时停止跟踪 `kmalloc` 事件。 每次读取系统调用退出时都会禁用：

```shell
# echo 'disable_event:kmem:kmalloc' > \
    /sys/kernel/debug/tracing/events/syscalls/sys_exit_read/trigger
```

格式为 

```shell
enable_event:<system>:<event>[:count]
disable_event:<system>:<event>[:count]
```

移除命令格式为： 

```shell
# echo '!enable_event:kmem:kmalloc:1' > \
    /sys/kernel/debug/tracing/events/syscalls/sys_enter_read/trigger

# echo '!disable_event:kmem:kmalloc' > \
    /sys/kernel/debug/tracing/events/syscalls/sys_exit_read/trigger
```

每个`trigger event`可以有任意数量的 `enable/disable_event `触发器，但每个被触发事件只能有一个触发器。 `sys_enter_read `可以有同时启用 `kmem:kmalloc` 和 `sched:sched_switch` 的触发器，但不能有两个` kmem:kmalloc` 版本，如 `kmem:kmalloc` 和 `kmem:kmalloc:1` 或 `kmem:kmalloc if bytes_req == 256 `和 `kmem:kmalloc if bytes_alloc == 256`（不过它们可以合并为 `kmem:kmalloc` 的一个过滤器）。

#### command: stack trace

每当触发事件发生时，该命令都会在跟踪缓冲区中转储堆栈跟踪。

例如，下面的触发器会在每次`kmalloc` 跟踪点被击中时转储堆栈跟踪：

```shell
# echo 'stacktrace' > \
      /sys/kernel/debug/tracing/events/kmem/kmalloc/trigger
```

下面的触发器会转储前 5 次` kmalloc `请求（大小 >= 64K）的堆栈跟踪：

```shell
# echo 'stacktrace:5 if bytes_req >= 65536' > \
      /sys/kernel/debug/tracing/events/kmem/kmalloc/trigger
```

格式为：

```shell
stacktrace[:count]
```

#### command: traceon/traceoff

类似

#### command:snapshot

类似

### 合成事件

在大多数情况下，命令行界面足以跟踪事件。然而，有时应用程序可能会发现需要更复杂的关系，而无法通过一系列简单的链接命令行表达式来表达，或者将命令集放在一起可能太麻烦了。例如，应用程序需要“监听”跟踪流，以便维护内核状态机来检测调度程序中何时发生非法内核状态。

跟踪事件子系统提供了一个内核 API，允许模块或其他内核代码随意生成用户定义的“合成”事件，这些事件可用于增强现有的跟踪流或发出信号表示某个特定的重要状态已经发生。

类似的内核 API 也可用于创建 `kprobe` 和 `kretprobe` 事件。

合成事件和 `k(ret)probe` 事件 API 均建立在低级`dynevent_cmd`事件命令 API 之上，该 API 也可用于更专业的应用程序，或作为其他高级跟踪事件 API 的基础。

为此目的提供的 API 如下所述，并允许执行以下操作：

- 动态创建合成事件定义
- 动态创建` kprobe` 和 `kretprobe` 事件定义
- 通过内核代码触发合成事件的追踪
- 低层次的 `dynevent_cmd` API

#### 动态创建合成事件定义

可以参考`trace/synth_event_gen_test.c`

**第一种方法：一次性创建**

使用 `synth_event_create()` 函数，一步创建事件。传递事件名称和包含字段的数组即可，如果成功，事件将被注册并可立即使用。

```c
ret = synth_event_create("schedtest", sched_fields, ARRAY_SIZE(sched_fields), THIS_MODULE);
```

`sched_fields` 为 `struct synth_field_desc` 数组，描述了每个字段的类型和名称，如 `pid_t`、`u64` 等。

```c
static struct synth_field_desc sched_fields[] = {
      { .type = "pid_t",              .name = "next_pid_field" },
      { .type = "char[16]",           .name = "next_comm_field" },
      { .type = "u64",                .name = "ts_ns" },
      { .type = "u64",                .name = "ts_ms" },
      { .type = "unsigned int",       .name = "cpu" },
      { .type = "char[64]",           .name = "my_string_field" },
      { .type = "int",                .name = "my_int_field" },
};
```

**See `synth_field_size()` for available types.**

**第二种方法：分步动态创建**

在第二种方法中，事件是分几步创建的。 这样就可以动态创建事件，而无需事先创建和填充字段数组。

使用 `synth_event_gen_cmd_start()` 或 `synth_event_gen_cmd_array_start()` 开始创建事件，然后逐个添加字段。

- 使用 `synth_event_add_field()` 添加单个字段，或用 `add_synth_fields()` 批量添加字段。
- 最后调用 `synth_event_gen_cmd_end()` 完成注册。

```c
struct dynevent_cmd cmd;
char *buf = kzalloc(MAX_DYNEVENT_CMD_LEN, GFP_KERNEL);
synth_event_cmd_init(&cmd, buf, MAX_DYNEVENT_CMD_LEN);

ret = synth_event_gen_cmd_start(&cmd, "schedtest", THIS_MODULE, "pid_t", "next_pid_field", "u64", "ts_ns");
```

然后逐个添加字段，并最终完成注册：

```c
ret = synth_event_add_field(&cmd, "int", "intfield");
ret = synth_event_gen_cmd_end(&cmd);
```

#### 跟踪合成事件

要跟踪合成事件，有几种选择。 第一种方法是使用带有可变数值的 `synth_event_trace()`，或带有待设置数值数组的 `synth_event_trace_array()`，在一次调用中跟踪事件。 第二种方法是通过 `synth_event_trace_start() `和 `synth_event_trace_end() `以及` synth_event_add_next_val()` 或 `synth_event_add_val()`逐个添加值，从而避免使用预先形成的值数组或参数列表。

```c
ret = synth_event_trace(create_synth_test, 7, /* number of values */
                        444,             /* next_pid_field */
                        (u64)"clackers", /* next_comm_field */
                        1000000,         /* ts_ns */
                        1000,            /* ts_ms */
                        smp_processor_id(),/* cpu */
                        (u64)"Thneed",   /* my_string_field */
                        999);            /* my_int_field */);
```

#### 结构体

```c
  struct trace_event_class {   
          const char              *system;
          void                    *probe; 
  #ifdef CONFIG_PERF_EVENTS    
          void                    *perf_probe;                    
  #endif
          int                     (*reg)(struct trace_event_call *event,
                                         enum trace_reg type, void *data);
          struct trace_event_fields *fields_array;
          struct list_head        *(*get_fields)(struct trace_event_call *);
          struct list_head        fields; 
          int                     (*raw_init)(struct trace_event_call *);
  };
```

#### DECLARE_EVENT_CLASS

下面的示例，通过`DECLARE_EVENT_CLASS` 定义了一个`EVENT CLASS`

**属于同一个CLASS的EVENT，函数参数必须相同，并且trace打印格式相同**

```c
  /*
   * Tracepoint for waking up a task:
   */
  DECLARE_EVENT_CLASS(sched_wakeup_template,

          TP_PROTO(struct task_struct *p),

          TP_ARGS(__perf_task(p)),

          TP_STRUCT__entry(
                  __array(        char,   comm,   TASK_COMM_LEN   )
                  __field(        pid_t,  pid                     )
                  __field(        int,    prio                    )
                  __field(        int,    target_cpu              )
          ),

          TP_fast_assign(
                  memcpy(__entry->comm, p->comm, TASK_COMM_LEN);
                  __entry->pid            = p->pid;
                  __entry->prio           = p->prio; /* XXX SCHED_DEADLINE */
                  __entry->target_cpu     = task_cpu(p);
          ),

          TP_printk("comm=%s pid=%d prio=%d target_cpu=%03d",
                    __entry->comm, __entry->pid, __entry->prio,
                    __entry->target_cpu)
  );
    /*
   * Tracepoint called when waking a task; this tracepoint is guaranteed to be
   * called from the waking context.
   */
  DEFINE_EVENT(sched_wakeup_template, sched_waking,
               TP_PROTO(struct task_struct *p),
               TP_ARGS(p));
  /*
   * Tracepoint called when the task is actually woken; p->state == TASK_RUNNING.
   * It is not always called from the waking context.
   */
  DEFINE_EVENT(sched_wakeup_template, sched_wakeup,
               TP_PROTO(struct task_struct *p),
               TP_ARGS(p));
```

`DECLARE_EVENT_CLASS` 宏详解,最终展开会形成如下代码

```c
struct trace_entry {
          unsigned short          type;
          unsigned char           flags;
          unsigned char           preempt_count;
          int                     pid;
};

struct trace_event_raw_template {
                  struct trace_entry      ent;
                  char    common[TASK_COMM_LEN]；
                  pid_t    pid; 
                  int, prio;
                  int target_cpu;
                  char                    __data[];
};  
static struct trace_event_class event_class_template;

struct trace_event_data_offsets_template {
 };

 static notrace enum print_line_t                                       
 trace_raw_output_template(struct trace_iterator *iter, int flags,       
                          struct trace_event *trace_event)              
  {                                                                     
          struct trace_seq *s = &iter->seq;                             
          struct trace_seq __maybe_unused *p = &iter->tmp_seq;          
          struct trace_event_raw_template *field;                         
          int ret;                                                      

          field = (typeof(field))iter->ent;                             

          ret = trace_raw_output_prep(iter, trace_event);               
          if (ret != TRACE_TYPE_HANDLED)                                
                  return ret;                                           

          trace_event_printf(iter, print);                              

          return trace_handle_return(s);                                
}

static struct trace_event_functions trace_event_type_funcs_template = { 
          .trace                  = trace_raw_output_template,            
};


static struct trace_event_fields trace_event_fields_template[] = { 
          {.type =char [TASK_COMM_LEN], .name = common, .size = ,.len =  }
          {.type = pid_t, .name = pid, .size = 4, .is_sigend = true, .filter_type = FILTER_OTHER}
            {} };

  static inline notrace int trace_event_get_offsets_template(             
          struct trace_event_data_offsets_template *__data_offsets, proto)
  {                                                                     
          int __data_size = 0;                                          
          int __maybe_unused __item_length;                             
          struct trace_event_raw_template __maybe_unused *entry;                                                                                                                 
          return __data_size;                                           
  }

 static notrace void                                                     
  trace_event_raw_event_template(void *__data, proto)
  {                                                                       
          struct trace_event_file *trace_file = __data;                   
          struct trace_event_data_offsets_template __maybe_unused __data_offsets;
          struct trace_event_buffer fbuffer;                              
          struct trace_event_raw_template *entry;                           
          int __data_size;                                                

          if (trace_trigger_soft_disabled(trace_file))                    
                  return;                                                 

          __data_size = trace_event_get_offsets_template(&__data_offsets, args); 

          entry = trace_event_buffer_reserve(&fbuffer, trace_file,
                                   sizeof(*entry) + __data_size); 

          if (!entry)      
                  return;  
          trace_event_buffer_commit(&fbuffer);      
  }
_TRACE_PERF_PROTO(call, PARAMS(proto));                                 
static char print_fmt_##call[] = print;                                
```

最终其实就是构造出一个 `trace_event_class` 

```c
  static struct trace_event_class __used __refdata event_class_##call = {
          .system                 = TRACE_SYSTEM_STRING,                 
          .fields_array           = trace_event_fields_template,           
          .fields                 = LIST_HEAD_INIT(event_class_template.fields),
          .raw_init               = trace_event_raw_init,           
          .probe                  = trace_event_raw_event_template,   
          .reg                    = trace_event_reg,                
          _TRACE_PERF_INIT(call)
  };
```

总结： 

- 定义了一个结构体 `trace_event_raw_template`

- 定义了`event->funcs` :   `trace_event_type_funcs_template` 

- 定义了 `class->fileds_array` : `trace_event_fields_template`

- 定义了`class->probe` :  `trace_event_raw_event_template`

#### trace_event_reg

`trace_event_reg` 核心作用在于为 属于同一个`calss` 的`trace_event_call`(下一小节会讲) 提供一个统一的`tracepoints` 探测函数注册，探测函数为`class->probe` 

#### trace_event_raw_init

属于同一个`calss` 的`trace_event_call`(下一小节会讲) 提供一个统一的初始化能力

### Trace Event Call

#### 数据结构

```c
struct trace_event_functions {
          trace_print_func        trace;
          trace_print_func        raw;
          trace_print_func        hex;
          trace_print_func        binary;
};

struct trace_event {
          struct hlist_node               node;
          int                             type;
          struct trace_event_functions    *funcs;
};

struct trace_event_call {
          struct list_head        list;
          struct trace_event_class *class;
          union {
                  char                    *name;
                  /* Set TRACE_EVENT_FL_TRACEPOINT flag when using "tp" */
                  struct tracepoint       *tp;
          };
          struct trace_event      event;
          char                    *print_fmt;
          struct event_filter     *filter;
          /*
           * Static events can disappear with modules,
           * where as dynamic ones need their own ref count.
           */
          union {
                  void                            *module;
                  atomic_t                        refcnt;
          };
          void                    *data;

          /* See the TRACE_EVENT_FL_* flags above */
          int                     flags; /* static flags of different events */

  #ifdef CONFIG_PERF_EVENTS
          int                             perf_refcount;
          struct hlist_head __percpu      *perf_events;
          struct bpf_prog_array __rcu     *prog_array;

          int     (*perf_perm)(struct trace_event_call *,
                               struct perf_event *);
  #endif
};
```

#### DEFINE EVENT

`DEFINE_EVENT` 配合`DECLARE_EVENT_CLASS` 目的其实就是构造出 一个`trace_event_call`的实例；

**TRACE_EVENT =  DECLARE_EVENT_CLASS + DEFINE_EVENT**

我们看一下 `DEFINE_EVENT`最终展开的内容

```c
static struct trace_event_call __attribute__((__aligned__(4))) \
   event_##name


  static inline void ftrace_test_probe_##call(void)    
  {
    check_trace_callback_type_##call(trace_event_raw_event_##template);
  }

static struct trace_event_call __used event_##call = {                
          .class                  = &event_class_##template,            
          {                                                             
                  .tp                     = &__tracepoint_##call,       
          },                                                            
          .event.funcs            = &trace_event_type_funcs_##template, 
          .print_fmt              = print_fmt_##template,               
          .flags                  = TRACE_EVENT_FL_TRACEPOINT,          
  };                                                                    
  static struct trace_event_call                            
  __section("_ftrace_events") *__event_##call = &event_##call
```

#### trace_event_call 注册

书接上次，我们说到`TRACE_EVENT` 最终会在段`_ftrace_events` 声明一个 `trace_event_call` 该段实际注册发生在 `trace_init`

```c
static __init int event_trace_enable(void)
  -> 遍历_ftrace_events 
    -> event_init(trace_event_call)
      -> call->class->raw_init: 初始化为 trace_event_raw_init 
       -> trace_event_raw_init 
         -> register_trace_event（call->event）
            -> 注册trace_event 到 全局的event_hash 链表
         -> test_event_printk(call) 
    -> list_add(&call->list, &ftrace_events); ： 加入全局链表: ftrace_events
  -> register_trigger_cmds()
  -> __trace_early_add_events(tr)
     -> 遍历_ftrace_events  
        -> __trace_early_add_new_event(call)
          -> trace_create_new_event(call,tr)
          -> event_define_fields(call)
          -> trace_early_triggers(file,name) bootup trigger 
  -> early_enable_events()
  -> register_event_cmds()
```
