## Slxb config

版本 v6.12

`slxb allocator`模块配置

### 功能配置

只列举需要重点关注 并且可能需要定制化配置的

| config               | owner | 默认值           | 重点关注 | 配置建议                        |
| -------------------- | ----- | ------------- | ---- | --------------------------- |
| CONFIG_SLUB_TINY     | SLUB  | n             | 是    | 嵌入式场景 尤其是内存在<16MB的场景下 开启此选项 |
| CONFIG_SLUB_DEBUG    | SLUB  | y             | 是    | SLUB DEBUG                  |
| CONFIG_SLUB_DEBUG_ON | SLUB  | n             | 否    | 是否默认开启slub_debug 默认不开启      |
| SLUB_STATS           | SLUB  | n             | 否    | SLUB 性能统计                   |
| SLUB_RCU_DEBUG       | SLUB  | KASAN_GENERIC | 否    | RCU调试                       |
|                      |       |               |      |                             |
|                      |       |               |      |                             |
|                      |       |               |      |                             |
|                      |       |               |      |                             |
|                      |       |               |      |                             |
|                      |       |               |      |                             |
|                      |       |               |      |                             |
|                      |       |               |      |                             |
|                      |       |               |      |                             |
|                      |       |               |      |                             |
|                      |       |               |      |                             |
|                      |       |               |      |                             |
|                      |       |               |      |                             |
|                      |       |               |      |                             |
|                      |       |               |      |                             |
|                      |       |               |      |                             |
|                      |       |               |      |                             |
|                      |       |               |      |                             |
|                      |       |               |      |                             |
|                      |       |               |      |                             |
|                      |       |               |      |                             |
|                      |       |               |      |                             |
|                      |       |               |      |                             |
|                      |       |               |      |                             |
|                      |       |               |      |                             |
|                      |       |               |      |                             |
