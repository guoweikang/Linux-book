## 基础设施： TraceFs

### 介绍

应该可以说`TRACE_FS` 是整个`trace` 子系统中比较重要的一个部分，几乎所有的用户接口都是通过`tracefs`下面的文件完成的

之所以现在把`tracefs`的介绍放在这里，一是因为之前的章节，我们都还是介绍一些基本的`trace`机制，使用方法，主要都还是通过基础的`API`实现，本章节开始，我们要逐步学习更加偏上层的功能实现，而`tracefs`提供给了我们对上层实现剖析的一个线头。

### 初始化

#### 初始化： tracefs_init

```c
// fs/tracefs/inode.c
   static int __init tracefs_init(void)
  {
          tracefs_inode_cachep = kmem_cache_create("tracefs_inode_cache",
                                                   sizeof(struct tracefs_inode),
                                                   0, (SLAB_RECLAIM_ACCOUNT|
                                                       SLAB_MEM_SPREAD|
                                                       SLAB_ACCOUNT),
                                                   init_once);

          retval = sysfs_create_mount_point(kernel_kobj, "tracing");
          retval = register_filesystem(&trace_fs_type);
          tracefs_registered = true;
  }
  core_initcall(tracefs_init);
```

`tracefs`文件系统类型在 这里完成注册

#### 挂载： tracer_init_tracefs

`tracefs`的挂载, 在`tracer_init_tracefs` 完成

```c
 fs_initcall(tracer_init_tracefs);

 tracer_init_tracefs()
   // per cpu lock init 
   -> trace_access_lock_init() 
   // 创建tracing的顶层自动挂载目录 /debug/tracing
   -> tracing_init_dentry()  
      // global_trace 为顶层的trace array
      -> struct trace_array *tr = &global_trace;
      -> debugfs_create_automount("tracing", NULL,trace_automount, NULL)
   // 放入workqueue 延后初始化
   -> INIT_WORK(&tracerfs_init_work, tracer_init_tracefs_work_func);
   -> queue_work(eval_map_wq, &tracerfs_init_work);
```

- trace_array: 暂时不关注，但是很重要，是trace 的顶层结构体

- global_trace： tracing 中最顶层 的结构体

- 可以看到： `tracing`顶层目录 属于 global_trace 

```c
tracer_init_tracefs_work_func() 
  // 非常重要EventTrace 初始化
 -> event_trace_init();
  // 非常重要 tracer 的文件初始化 
 -> init_tracer_tracefs(&global_trace, NULL);
 // dyn /  profile trace_stat 的初始化
 -> ftrace_init_tracefs_toplevel(&global_trace, NULL);
 -> trace_create_eval_file(NULL);
 -> register_module_notifier(&trace_module_nb);
 -> trace_create_file("dyn_ftrace_total_info"
 -> create_trace_instances(NULL);
 -> update_tracer_options(&global_trace);
```

这里的每一个过程都非常重要，我们在接下来各个子系统的学习时，就是要在这里找到对应的用户接口，然后再分别分析

- event_trace_init:  `Event Trace` 初始化 

- init_tracer_tracefs： `tracer` 相关的初始化

- ftrace_init_tracefs_toplevel： 有关 `dynamic ftrace`的初始， 这里我们再讲dyn ftrace 涉及到过

- tracing_thresh / README/saved_cmdlines/saved_cmdlines_size/saved_tgids等创建

- 
