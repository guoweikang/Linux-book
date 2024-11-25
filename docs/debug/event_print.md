## TRACE EVENT

### 介绍

#### 回顾

回顾上一章节，`trace_points` 知识点：

- `static key` 对 某些固定场景的`branch miss` 优化 原理实现

- 如何使用 `DECLARE_TRACE` `DEFINE_TRACE` API 定义`tracepoints`

- 使用`register_trace_##name`注册回调函数

- 源文件中使用`trace__##name` 显示添加`probe handler`

#### Trace Event

- 什么是机制: 比如 `ftrace` 是一个机制 

- 基于某种机制的实现 ： 比如 `stack trace`是基于`ftrace`实现的功能

我们目前为止已经学习过的 `ftrace` `fprobe` `kprobe` `tracepoints` 都只是机制，开发者当然可以基于这些机制，一种甚至多种，实现更加实用的`trace` 

回顾我们一开始认为`trace`需要完成的功能:  

- 可以在内核代码的任意位置中插入探测函数（`probe func`）

- `probe func`可以获得当前上下文内容(函数、参数)

- `probe func` 最好可以可以动态的`enable/disable`

- 可以支持一些高级过滤功能

是否可以有一个更加通用的框架，可以针对不同的`trace`机制，提供一些常用的能力？

- 可以提供行为接口一致的`tracefs`接口，比如`enable/disable`

- `trace`最为常用的功能可能就是打印，是否可以提供一致的打印接口？

- 基于日志内容字段的过滤

- ...



这就是我们本章需要重点学习的内容，`Trace Event`框架

### Subsystem

`trace_event` 可以属于同一个子系统，子系统可以认为是对 event的一个归类 

比如我们可以直接禁用 某个子系统下面的所有event

#### tracefs

`tracing/events/`里展示的目录，表示当前系统的注册的所有子系统

`tracing/events/subsys/enable` : 子系统使能的用户态接口

`tracing/events/subsys/filter` : 子系统过滤的接口，具体使用在`tracepoints events`章节介绍

`tracing/events/subsys/xxx/` : 子系统包含的`events`，每个event又是一个单独的目录



#### struct event_subsystem

子系统核心结构体

```c
  struct event_subsystem {
          struct list_head        list;
          const char              *name;    //
          struct event_filter     *filter;   // 过滤
          int                     ref_count; //引用计数
  };
```



#### struct trace_subsystem_dir

```c
  struct trace_subsystem_dir {
          struct list_head                list;
          struct event_subsystem          *subsystem;
          struct trace_array              *tr;
          struct eventfs_file             *ef;
          int                             ref_count;
          int                             nr_events;
  };  
```

子系统的`tracefs` 管理节点


