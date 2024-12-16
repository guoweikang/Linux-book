## rw_semaphore

```json
"node" {
    "label": "rw_sem",
    "categories": ["foundation"],
    "info": "linux rw_semaphore ",
    "depends": [
         "lock_dep"
    ]
}
```

### 介绍

内核同步机制的一种，主要用在 读写锁保护场景，特点：

- 睡眠锁/非睡眠锁(`try_lock`)

- 支持多任务读，只允许单任务写

- 非实时配置下，是公平的，写任务不会被饿死

- 默认遵从严格的所有者语义，但也存在一些特殊用途接口，允许非所有者释放读锁。 这些接口的工作与内核配置无关。

- 实时开启下，带有优先级的锁，不同于普通的优先级反转实现机制( 高优先级如果等锁，会调高持锁任务优先级),  由于读锁可以被多人持有， 高优先级的写任务，不会做这种动作(提高所有读任务的优先级)，所以高优先级写任务可能陷入 饥饿。但是相反，如果高优先级读任务尝试持锁，可以提高 写任务的优先级，因此实时配置开启的情况下，优先级反转仅预防了一个方向 

### 使用

#### 相关内核配置项

- CONFIG_DEBUG_RWSEMS : 锁调试  

- CONFIG_RWSEM_SPIN_ON_OWNER: 

- DEBUG_LOCK_ALLOC ： 锁调试 检查活锁释放错误

#### 声明和初始化

```c
#include  <linux/rwsem.h>
static DECLARE_RWSEM(name);
//非静态锁初始化
struct rw_semaphore rw;
init_rwsem(&rw)
```

#### 持(释放)锁

```c
/* attempt to acquire the semaphore for reading ... */
down_read(_kilable/interruptible)(&mr_rwsem);

/* critical region (read only) ... */

/* release the semaphore */
up_read(&mr_rwsem);

/* ... */

/* attempt to acquire the semaphore for writing ... */
down_write(&mr_rwsem);

/* critical region (read and write) ... */

/* release the semaphore */
up_write(&mr_sem);
```

#### try_lock

与 semaphores 类似，也提供了` down_read_trylock() `和 `down_write_trylock() `的实现。 每个函数都有一个参数：

- 指向读写器信号的指针。 如果锁被成功获取，它们都会返回非零值（1）；

- 如果锁正在被争夺，它们都会返回零值。 请注意 这与正常的信号行为恰恰相反！
  
  !!! note
  
    `try_lock` 不会导致任务睡眠，可以在中断上下文使用

#### 锁降级

支持写锁持有者 把当前锁 降级成为读锁 

```c
void downgrade_write(struct rw_semaphore *sem)
```

#### 使用建议

当临界区的任务 在`读写`操作有非常明确边界，并且读任务相比于写任务次数确实非常多，使用是合适的，否则 锁自身引入的性能开销可能会超过优化的性能开销 

### 核心实现

#### struct rw_semaphore

```c
 struct rw_semaphore {
          atomic_long_t count;
          /*
           * Write owner or one of the read owners as well flags regarding
           * the current state of the rwsem. Can be used as a speculative
           * check to see if the write owner is running on the cpu.
           */
          atomic_long_t owner;
  #ifdef CONFIG_RWSEM_SPIN_ON_OWNER
          struct optimistic_spin_queue osq; /* spinner MCS lock */
  #endif
          raw_spinlock_t wait_lock;
          struct list_head wait_list;
  #ifdef CONFIG_DEBUG_RWSEMS
          void *magic;
  #endif
  #ifdef CONFIG_DEBUG_LOCK_ALLOC
          struct lockdep_map      dep_map;
  #endif
  };
```

#### count 布局

32位架构（`atomic_long_t`）

- bit 0  `RWSEM_WRITER_LOCKED`:  标识 `writer locked`(仅支持 一个写 所以1bit)

- bit 1 `RWSEM_FLAG_WAITERS`:  标识是否有任务在等待队列

- bit 2  `RWSEM_FLAG_HANDOFF`: 

- bit 3 - 7: 保留

- bits 8 -30 : 支持 23个bit用于 标识读任务数量

- bit 31:  读任务溢出位

64位架构（`atomic_long_t`）

- bits 8 -62 : 支持 23个bit用于 标识读任务数量

- bit 63: 读任务溢出位

`count`字段非常重要，类似于一个传统的`spinlock`中的原子变量，被用于维护锁状态，并保证锁状态的原子性操作

几个重要的状态：

- `RWSEM_READ_FAILED_MASK` : 仅`READER` 字段有值，其余字段都置空，表示仅有读任务在持锁，没有任务等待，此时正常获取读锁

- `RWSEM_UNLOCKED_VALUE`: 0，无任何人持锁

#### owner

`owner` 用于记录保存持锁的任务的  `task`指针 有些特别的地方在于

- 读任务会有多个，后一个会覆盖前一个任务

- 使用`bit 0` 标识 `owner` 是 读任务还是写任务 (1表示读任务)

- 使用`bit 1` 标识 是否支持 `spin` 

#### count 保护

和正常的同步机制一样，因为睡眠锁不应该被用于中断上下文，因此原子量`count`的保护 只需要 关闭抢占`preemt_disable` 防止 `AA`死锁即可

#### wait_list 的保护

正常来说，如果我们认为 `rw_sem` 不应该用在中断上下文，则 `wait_list` 只需要使用简单 `spin_lock`保护，但是不幸的时，由于我们支持`try_lock`机制，`try_lock` 允许在中断上下文使用，因此必须要使用 关中断锁 `raw_spin_lock_irq`(普通的锁假设一定是再开中断场景下使用（因为锁会进行调度），因此不涉及中断状态恢复，不需要保存`irq_flags`)

#### waiter

`wait_list` 节点定义 定义等待任务

```c
  enum rwsem_waiter_type {
          RWSEM_WAITING_FOR_WRITE,
          RWSEM_WAITING_FOR_READ
  };

  struct rwsem_waiter {
          struct list_head list;
          struct task_struct *task;
          enum rwsem_waiter_type type;
          unsigned long timeout;
          bool handoff_set;
  }; 
```

#### __down_read_trylock

仅处理 `RWSEM_READ_FAILED_MASK`满足的情况，其余情况都直接返回失败

```c
static inline int __down_read_trylock(struct rw_semaphore *sem)
  {
          preempt_disable();
          tmp = atomic_long_read(&sem->count);
          while (!(tmp & RWSEM_READ_FAILED_MASK)) {
                  if (atomic_long_try_cmpxchg_acquire(&sem->count, &tmp,
                                                      tmp + RWSEM_READER_BIAS)) {
                          rwsem_set_reader_owned(sem);
                          ret = 1;
                          break;
                  }
          }
          preempt_enable();
          return ret;
  }
```

#### __down_write_trylock

仅处理 `RWSEM_UNLOCKED_VALUE`满足的情况，其余情况都直接返回失败

```c
  static inline bool rwsem_write_trylock(struct rw_semaphore *sem)
  {
          long tmp = RWSEM_UNLOCKED_VALUE;

          if (atomic_long_try_cmpxchg_acquire(&sem->count, &tmp, RWSEM_WRITER_LOCKED)) {
                  rwsem_set_owner(sem);
                  return true;
          }

          return false;
  }
```

#### rwsem_down_read_slowpath

进入慢路径之前，总会先`try_lock` 一次，尝试快路径是否可以申请成功；
 因此 进入慢路径的时候，说明快路径失败了，读锁的失败原因可能为：

1. 没有写任务持锁，有读锁持锁，但是等待队列有写任务再等锁

2. 已经有写任务持锁

##### 写任务优先

 核心在于通过设置`WAIT_FLAGS`，一旦已经有任务再等锁，不会再允许新的读任务持锁，会把新的读任务放在等待队列尾部

#### spinable

像普通的`futex`实现一样，休眠调度的代价有时是无法忍受的的，所以一般会在真的进入调度之前，尝试自旋一会，`rw_sem`也实现了类似的机制，依赖于平台架构支持

#### 竞争的情况

我们假设A是已经持锁的任务

| A任务         | B任务         | 存在竞争？ | 行为         |
| ----------- | ----------- | ----- | ---------- |
| writer_lock | writer_lock | 是     |            |
| writer_lock | reader_lock | 是     | wait       |
| reader_lock | writer_lock | 是     |            |
| reader_lock | reader_lock | 否     | inc Reader |
|             |             |       |            |
