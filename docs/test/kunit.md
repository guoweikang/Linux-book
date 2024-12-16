## Kunit

```json
"node" {
    "label": "kunit",
    "categories": ["test"],
    "info": "kernel unit test",
    "depends": []
}
```

本章节，我们介绍`linux`的 单元测试用例 





### 介绍

KUnit 是一个适用于 Linux 内核的轻量级单元测试和模拟框架。 KUnit 在很大程度上受到了 JUnit、Python 的 unittest.mock 和 Googletest/Googlemock for C++ 的启发。 KUnit 提供了定义单元测试用例、将相关测试用例组合成测试套件、为运行测试提供通用基础架构等功能。 KUnit 由一个内核组件组成，该组件提供了一组宏，用于轻松编写单元测试。 根据 KUnit 编写的测试将在内核启动时运行（如果是内置的），或在加载时运行（如果是作为模块构建的）。 为了让运行这些测试（和读取结果）更容易，KUnit 提供了 kunit_tool，它能构建用户模式 Linux 内核、运行它并解析测试结果。 这提供了一种在开发过程中快速运行 KUnit 测试的方法，而不需要虚拟机或单独的硬件。





#### why

单元测试应该是孤立地测试单个单元的代码，这也是单元测试名称的由来。 

单元测试应该是最小粒度的测试，因此应该允许在被测代码中测试所有可能的代码路径；这只有在被测代码非常小，并且不存在测试控制之外的任何外部依赖（如硬件）的情况下才有可能。

 KUnit 为内核中的单元测试提供了一个通用框架。 KUnit 测试可在大多数架构上运行，而且大多数测试与架构无关。 所有内置的 KUnit 测试都在内核启动时运行。

 另外，KUnit 和 KUnit 测试可作为模块构建，测试将在加载测试模块时运行。



 !!! note

   

     KUnit 还能在用户模式 Linux 下运行测试，而无需虚拟机或实际硬件。
     用户模式 Linux 是一种 Linux 架构，如 ARM 或 x86，
     可将内核编译为 Linux 可执行文件。
      KUnit 可通过 ARCH=um 构建（像其他架构一样）或
     使用 kunit_tool 与 UML 配合使用。

KUnit 非常快。 除去构建时间，从调用到完成，KUnit 只需 10 到 20 秒就能运行几十个测试；对某些人来说，这可能听起来没什么大不了，但拥有如此快速、易于运行的测试，将从根本上改变你的测试方式，甚至是编写代码的方式。 莱纳斯本人在谷歌的 git 演讲中说过



### 快速上手



#### 用户模式执行

KUnit 包含一个简单的 Python 封装程序，它能在用户模式 Linux 下运行测试，并将测试结果格式化。 

```shell
# ./tools/testing/kunit/kunit.py run

```



#### 选择用例执行

默认情况下，kunit_tool 会以最少的配置运行所有可以到达的测试，也就是说，大多数 kconfig 选项都使用默认值。 不过，你也可以选择运行哪些测试：

##### 定制kconfig

.kunitconfig 的良好起点是 KUnit 默认配置。 如果尚未运行 kunit.py run，可通过运行以下命令生成配置：

```shell
cd $PATH_TO_LINUX_REPO
tools/testing/kunit/kunit.py config
cat .kunit/.kunitconfig
```



 !!! note

  

    .kunitconfig 位于 kunit.py 使用的 --build_dir（默认为 .kunit）中。
    
    

在运行测试之前，kunit_tool 会确保 .kunitconfig 中设置的所有配置选项都已在内核 .config 中设置。 如果没有为所使用的选项添加依赖项，它会发出警告。



自定义配置的方法很多：

- 编辑 .kunit/.kunitconfig。 该文件应包含运行所需测试所需的 kconfig 选项列表，包括它们的依赖关系。 你可能想从 .kunitconfig 中移除 CONFIG_KUNIT_ALL_TESTS（所有测试），因为它会启用一些你可能不需要的额外测试。 如果需要在 UML 以外的架构上运行，请参阅在 QEMU 上运行测试。

- 在 .kunit/.kunitconfig 上启用额外的 kconfig 选项。 例如，要包含内核的链接列表测试，可以运行

```shell
 ./tools/testing/kunit/kunit.py run \
        --kconfig_add CONFIG_LIST_KUNIT_TEST=y
```

- 提供树中一个或多个 .kunitconfig 文件的路径。 例如，要只运行 FAT_FS 和 EXT4 测试，可以运行
  
  ```shell
  ./tools/testing/kunit/kunit.py run \
          --kunitconfig ./fs/fat/.kunitconfig \
          --kunitconfig ./fs/ext4/.kunitconfig
  ```


