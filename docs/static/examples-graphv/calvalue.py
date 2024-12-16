import json
from collections import defaultdict

def update_reference_counts(data):
    # 创建一个字典来记录每个 node 的引用计数，初始为 1
    reference_counts = {node["id"]: 1 for node in data["data"]["nodes"]}
    
    # 创建一个集合来记录每个节点的连接数量
    connected_nodes = defaultdict(set)
    
    # 遍历所有的 edge，建立每个节点的连接关系
    for edge in data["data"]["edges"]:
        # 双向关系：如果node A 依赖 node B，node B 也连接到 node A
        connected_nodes[edge["from"]].add(edge["to"])
        connected_nodes[edge["to"]].add(edge["from"])
    
    # 更新节点的引用计数
    for node_id in connected_nodes:
        reference_counts[node_id] = len(connected_nodes[node_id])  # 连接的节点数量作为引用计数
    
    # 更新 nodes 中的 value 字段
    for node in data["data"]["nodes"]:
        node["value"] = reference_counts[node["id"]]
    
    return data

# 从本地文件读取 JSON 数据
with open('linux_book_graph.json', 'r', encoding='utf-8') as file:
    data = json.load(file)

# 计算引用计数并更新节点
updated_data = update_reference_counts(data)

# 输出更新后的数据
with open('linux-book_update.json', 'w', encoding='utf-8') as file:
    json.dump(updated_data, file, ensure_ascii=False, indent=2)

print("处理完成，更新后的数据已保存到 'linux-book_update.json'")
