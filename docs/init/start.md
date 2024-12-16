## 启动流程分析

```json
"node" {
    "label": "kernel start",
    "categories": ["init"],
    "info": "kernel start process",
    "depends": []
}
```

### 汇编阶段

#### head.S

此段代码主要为汇编代码实现，一般位于 `arc/xxx/kernel/head.S`文件

汇编代码主要实现体系架构相关的初始化，包括不限于

- mmu 内存映射

- ...

### C

从汇编到`C`语言的世界 是从 `start_kernel` 开始 

#### start_kernel

start kernel 是 `C`的初始化流程入口  分为两个阶段

`reset_init` 之前 

#### rest_init

### 

### kernel_init

kernel_init 是用户态进程的开始 主要是准备执行用户态环境的初始化，并完成从内核态到用户态进程的切换

#### kernel_init_freeable
