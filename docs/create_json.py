import os
import json
from collections import defaultdict

# 用于生成唯一 ID
node_id_counter = 1

# 存储所有的节点信息
categories = defaultdict(str)
nodes = []
edges = []
node_dict = {}

# 用于生成 node id 的函数
def generate_unique_id():
    global node_id_counter
    node_id_counter += 1
    return node_id_counter

# 扫描当前目录下所有的 .md 文件
def process_md_files():
    # 获取当前目录下的所有 .md 文件
    for root, dirs, files in os.walk('.'):
        for file in files:
            if file.endswith('.md'):
                process_file(os.path.join(root, file))

# 处理每一个文件
def process_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 查找 JSON 格式的 node 字符串
    node_start = content.find('"node" {')
    node_end = content.find('}', node_start)
    
    # 如果找到了有效的 JSON 字符串，提取它
    if node_start != -1 and node_end != -1:
        node_str = content[node_start:node_end+1]
        
        try:
            # 将 JSON 字符串加载为字典
            node_data = json.loads('{' + node_str.split('{', 1)[1].rsplit('}', 1)[0] + '}')
            
            # 如果该 node 的类别没有出现过，记录它
            for category in node_data.get('categories', []): 
                print("get node ddata categories ",category)
                categories[category] = category
            
            # 生成节点，并为其生成唯一 ID
            node_id = generate_unique_id()
            node_data['id'] = node_id
            node_data['url'] = f"https://linux-book.readthedocs.io/en/latest/{file_path.replace('.md', '').replace(os.sep, '/')}"

            # 将节点数据存储到字典中
            node_dict[node_data['label']] = node_data
            
            # 暂时将节点添加到 nodes 列表中
            node_data['file_path'] = file_path  # 记录文件路径
            nodes.append(node_data)
        except json.JSONDecodeError as e:
            # 打印 JSON 解析失败的详细原因
            print(f"警告：文件 {file_path} 中的 JSON 解析失败！错误信息：{e}")

# 处理所有节点的依赖关系
def process_dependencies():
    for node in nodes:
        for dependency in node.get('depends', []):
            from_node_id = node['id']
            to_node_id = get_node_id_by_label(dependency)
            if to_node_id:
                edges.append({
                    "id": len(edges) + 1,
                    "label": "depend",
                    "from": from_node_id,
                    "to": to_node_id
                })
            else:
                # 如果依赖的节点不存在，打印警告
                print(f"警告：节点 '{node['label']}' 的依赖节点 '{dependency}' 未找到!")

# 获取节点 ID 通过其 label
def get_node_id_by_label(label):
    if label in node_dict:
        return node_dict[label]['id']
    return None

# 保存结果到 JSON 文件
def save_to_json():
    result = {
        "categories": categories,
        "data": {
            "nodes": nodes,
            "edges": edges
        }
    }
    
    with open('./static/examples-graphv/linux_book_graph.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

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


def cac_value():
    # 从本地文件读取 JSON 数据
    with open('./static/examples-graphv/linux_book_graph.json', 'r', encoding='utf-8') as file:
        data = json.load(file)

    # 计算引用计数并更新节点
    updated_data = update_reference_counts(data)

    # 输出更新后的数据
    with open('./static/examples-graphv/linux-book_update.json', 'w', encoding='utf-8') as file:
        json.dump(updated_data, file, ensure_ascii=False, indent=2)
    print("处理完成，更新后的数据已保存到 'linux-book_update.json'")

# 主函数
def main():
    process_md_files()
    process_dependencies()  # 在所有节点都收集完成后处理依赖关系
    save_to_json()
    print("处理完成，结果已保存为 'linux_book_graph.json'")
    cac_value()
    
if __name__ == "__main__":
    main()
