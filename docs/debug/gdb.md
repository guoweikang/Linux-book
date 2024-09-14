## gdb

gdb作为日常问题定位中不可缺少的一个工具，可以说和日常开发息息相关，本节想通过两部分对gdb介绍

- gdb的工作原理: 理论学习，并不对gdb的代码过多探索
- gdb常用命令: 根据实际工作场景不断补充

### 两种调试界面

我们都知道，内存中的执行程序，都是由二进制的指令和数据构成的，gdb可以把二进制指令翻译成为汇编，这并没有什么难度
但是对于更多开发人员，他们更关注自己的代码，而不是汇编，但是仅仅通过指令得到目标代码，是不现实的，为了完成这个目标，必须要
在编译的时候，通过建立代码和程序的关系，一般通过gcc -g 选项完成该工作

- 基于目标语言(C)的调试：依赖源文件、依赖目标程序的调试信息(通过编译增加-g选项）
- 基于汇编的调试：不依赖高级语言

### 常用调试命令

#### 控制窗口显示

- gdb  -tui: 以窗口模式打开gdb ，配合layout 命令使用
- layout asm/src: 窗口 显示汇编/源文件

#### 控制程序

- r ：restart 
- s : 进入函数

#### 断点

- break/b： 
- delete

#### 寄存器

- p/x $rax

#### 内存

- x/{n}{f}{u} addr 
- n 表示要打印的数量
- f 打印格式，支持d（decimal 十进制） x 十六进制  a 八进制
- u 每个打印单元长度: b(byte) h(2byte) w(4 byte) g(8 byte)

#### 历史命令查看

tui模式下 查看上一条 下一条命令

- ctrl+p previous
- ctrl+n next
- ctrl+b back
- ctrl+f forward

### QEMU GDB调试内核

#### 代码准备

```
$ make -p ~/code/
$ cd  ~/code/
$ git clone https://mirrors.tuna.tsinghua.edu.cn/git/linux.git
$ git remote add linux-next https://mirrors.tuna.tsinghua.edu.cn/git/linux-next.git
切换到next tree
$ git fetch  linux-next 
$ git fetch --tags linux-next
$ git tag -l "next-*" | tail
$ git checkout -b {my_local_branch} next-(latest)
```

#### 代码编译

[内核配置编译](https://www.kernel.org/doc/html/next/dev-tools/gdb-kernel-debugging.html)  需要关闭 `CONFIG_RANDOMIZE_BASE` 打开`CONFIG_GDB_SCRIPTS` 

```
$ make ARCH=x86_64 x86_64_defconfig (配置内核)
$ make ARCH=x86_64 menuconfig 
$ make -j8
$ qemu-system-x86_64  -kernel arch/x86/boot/bzImage -hda /dev/zero -append "root=/dev/zero console=ttyS0" -serial stdio -display none
#aarch64
$ make CROSS_COMPILE=aarch64-none-linux-gnu-  ARCH=arm64    O=build   defconfig
$ qemu-system-aarch64 -M virt -cpu cortex-a57 -smp 1 -m 4G   -kernel build_qemu/arch/arm64/boot/Image  -nographic  -append " earlycon console=ttyAM0"
```

由于此时还没有提供根目录，内核在启动 执行到挂载根目录就会panic 

#### 代码调试

现在可以增加`gdb选项` 调试内核了

```
$ qemu-system-x86_64 -s -S -no-kvm -kernel arch/x86/boot/bzImage -hda /dev/zero -append "root=/dev/zero console=ttyS0 nokaslr" -serial stdio -display none
```

这里我们启动内核增加了一个 nokaslr选项，关于kaslr的介绍请看 https://lwn.net/Articles/569635/, 如果有机会，我们在内核安全章节可能会学习介绍他

这里我们增加了 `-s -S` 选项，该选项会让GDB 卡住，直到gdb client 连接

修改~/.gdbinit 设置自动加载内核提供的gdb 脚本

```
add-auto-load-safe-path /home/test/code/linux/scripts/gdb/vmlinux-gdb.py
```

下面命令是在gdb里面执行的

```
$ 在另外一个窗口执行
$ cd  /home/test/linux/
$ gdb ./vmlinux
$ target remote localhost:1234
$ lx-symbols
$ break start_kernel 
$ layout src
```

现在可以单步调试了 [其他命令参考](https://www.kernel.org/doc/html/next/dev-tools/gdb-kernel-debugging.html)

#### 跨平台

```
$ gdb-multiarch vmlinux   
$ set architecture aarch64
$ target remote localhost:1234
$ lx-symbols
$ break start_kernel
$ layout src
```

#### 根目录制作

```
$ cd  ~/code
$ git clone git://git.buildroot.net/buildroot
$ make menuconfig （Target Options -> Target Architecture →x86_64; Filesystem images → ext2/3/4 root file system ）
$ make -j8
$ qemu-img convert -f raw -O qcow2 output/images/rootfs.ext2 output/images/rootfs.qcow2
```

现在已经拥有

- 内核image: arch/x86/boot/bzImage
- rootfs： buildroot/output/images/rootfs.ext2

```
$ qemu-system-x86_64 -s -kernel arch/x86/boot/bzImage \
    -boot c -m 2049M -hda ../buildroot/output/images/rootfs.ext2 \
    -append "root=/dev/sda rw console=ttyS0,115200 acpi=off nokaslr" \
    -serial stdio -display none

利用busybox 只启动一个ramdisk 文件系统 
$ qemu-system-aarch64 -M virt -cpu cortex-a57 -smp 1 -m 4G   -kernel build_qemu/arch/arm64/boot/Image  -nographic  -initrd ../busybox-1.36.1/initramfs.cpio.gz  -append " earlycon root=/dev/ram rdinit=/bin/sh "
```

## 内核参数

内核支持的参数[文档说明](https://www.kernel.org/doc/html/v4.14/admin-guide/kernel-parameters.html)

也可以在系统启动之后 通过 `cat /proc/cmdline` 查看
