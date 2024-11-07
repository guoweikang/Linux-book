## Kprobe

从本章节开始，我们开始介绍内核的`probe handler`调试手段。

### 需求描述

假设，我们现在正在开发或者测试或者定位内核的代码实现，比如

```c
int inc(int *data) {
    if(data) {
        return -1;
    }
    *data +=1;
    return 0;
}
```

我们希望查看 `inc`函数执行过程，最一般的方法可能就是使用 我们之前讲过的`printk`   

```c
int inc(int *data) {
    if(data) {
        pr_dbg("inc data is null!\n");
        return -1;
    }
    pr_dbg("inc data before is %d\n",*data);
    *data +=1;
    pr_dbg("inc data after is %d\n",*data);
    return 0;
}
```

在内核开发中，这样作的代价是？

- 每次增加调试内容，都需要修改代码和重新编译

- 每次删除调试内容，也需要修改代码和重新编译

我们希望有一个方法，可以动态的修改内核，
