## Events of Kprobe

### 介绍

回顾上一个小节的`Event Tracing`,我们已经知道它实际上是基于 `tracepoints`实现的探测；`tracepoints` 必须要通过提前在代码中 显示增加`trace_xxx`探测点才可以实现探测；

- `TRACE_EVENT` 定义`tracepoints`默认行为就是`trace`日志输出

- 支持动态过滤、动态使能

- 支持`trgiger command`实现`event`级联控制  

`krpbe trace evnets` 是基于`kprboe` 实现的探测，我们已经讲过`kprobe`的实现原理，和`tracepoints`最大不同在于是**动态设置探针**，不需要事先预埋；

### 用户接口

#### 配置

`CONFIG_KPROBE_EVENTS`配置项需要打开

设置方式通过`/sys/kernel/tracing/kprobe_events` 

#### 交互文件

`kprobe events` 主要通过下面文件完成配置

- `/sys/kernel/tracing/kprobe_events`:已经注册的`kprobe` 事件

### 代码接口

#### 动态创建

动态创建 `kprobe` 和`kreprobe event`，参考`Event Trace` 

参考代码`trace/kprobe_event_gen_test.c`

要从内核代码中创建 `kprobe` 或`kretprobe`跟踪事件，可以使用 `kprobe_event_gen_cmd_start()` 或 `kretprobe_event_gen_cmd_start()` 函数。

要创建一个`kprobe`事件，首先应使用 `kprobe_event_gen_cmd_start()`函数创建一个空的或部分空的 `kprobe` 事件。 应指定事件名称和探测位置，并向该函数提供一个或多个参数，每个参数代表一个探测字段。 在调用 `kprobe_event_gen_cmd_start()` 之前，用户应使用 `kprobe_event_cmd_init()` 创建并初始化一个 dynevent_cmd 对象。

```c
struct dynevent_cmd cmd;
char *buf;

/* Create a buffer to hold the generated command */
buf = kzalloc(MAX_DYNEVENT_CMD_LEN, GFP_KERNEL);

/* Before generating the command, initialize the cmd object */
kprobe_event_cmd_init(&cmd, buf, MAX_DYNEVENT_CMD_LEN);

/*
 * Define the gen_kprobe_test event with the first 2 kprobe
 * fields.
 */
ret = kprobe_event_gen_cmd_start(&cmd, "gen_kprobe_test", "do_sys_open",
                                 "dfd=%ax", "filename=%dx");
```

一旦创建了 kprobe 事件对象，就可以在其中填充更多字段。可以使用 `kprobe_event_add_fields()` 添加字段，并提供 `dynevent_cmd` 对象以及探测字段的变量参数列表。例如，要添加几个其他字段，可以进行以下调用：

```c
ret = kprobe_event_add_fields(&cmd, "flags=%cx", "mode=+4($stack)");
```

添加所有字段后，应通过调用 `kprobe_event_gen_cmd_end()` 或 `kretprobe_event_gen_cmd_end()` 函数来完成并注册事件，具体取决于是否启动了 `kprobe` 或 `kretprobe` 命令：

```c
ret = kprobe_event_gen_cmd_end(&cmd);
ret = kretprobe_event_gen_cmd_end(&cmd);
```

同样，可以使用 `kretprobe_event_gen_cmd_start()`创建 `kretprobe` 事件，并输入探针名称和位置以及 `$retval` 等附加参数：

与合成事件的情况类似，可以使用如下代码来启用新创建的 kprobe 事件：

```c
gen_kprobe_test = trace_get_event_file(NULL, "kprobes", "gen_kprobe_test");

ret = trace_array_set_clr_event(gen_kprobe_test->tr,
                                "kprobes", "gen_kprobe_test", true);
```

最后，与合成事件类似，可以使用以下代码返回 `kprobe` 事件文件并删除该事件：

```c
trace_put_event_file(gen_kprobe_test);

ret = kprobe_event_delete("gen_kprobe_test");
```
