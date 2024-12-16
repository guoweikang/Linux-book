## VFS Mount

```json
"node" {
    "label": "vfs mount",
    "categories": ["fs"],
    "info": "filesystem mount",
    "depends": [ 
       "fs_type",
       "fs_context"
    ]
}
```

在我们学习完`fs_type` 以及 `fs_context` 之后，可以到学习`fs_mount` 的时候了 

一个文件系统，在没有`mount`之前，就像是一个没有人使用的模具一样，文件系统只是定义了文件的组成形式，但是你的文件系统有多大？你的文件系统的存储介质在哪里?  这些都只有在一个文件系统被`mount`  之后才知道，只有被`mount`的文件系统才是可以使用的
