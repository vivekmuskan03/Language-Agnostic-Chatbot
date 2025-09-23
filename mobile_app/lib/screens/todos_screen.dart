import 'package:flutter/material.dart';
import '../services/api_client.dart';

class TodosScreen extends StatefulWidget {
  const TodosScreen({super.key});

  @override
  State<TodosScreen> createState() => _TodosScreenState();
}

class _TodosScreenState extends State<TodosScreen> with TickerProviderStateMixin {
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  List<Map<String, dynamic>> _todos = [];
  bool _loading = true;
  String? _error;
  String _filter = 'all'; // all, pending, completed
  late AnimationController _fabAnimationController;

  @override
  void initState() {
    super.initState();
    _fabAnimationController = AnimationController(
      duration: const Duration(milliseconds: 200),
      vsync: this,
    );
    _load();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _fabAnimationController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final items = await ApiClient.instance.listTodos();
      setState(() { _todos = items; });
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      if (mounted) setState(() { _loading = false; });
    }
  }

  Future<void> _showAddTodoDialog() async {
    _titleController.clear();
    _descriptionController.clear();

    await showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add New Todo'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _titleController,
              decoration: const InputDecoration(
                labelText: 'Title *',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.title),
              ),
              autofocus: true,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _descriptionController,
              decoration: const InputDecoration(
                labelText: 'Description (optional)',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.description),
              ),
              maxLines: 3,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              if (_titleController.text.trim().isNotEmpty) {
                Navigator.of(context).pop();
                _addTodo();
              }
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }

  Future<void> _addTodo() async {
    final title = _titleController.text.trim();
    if (title.isEmpty) return;

    try {
      await ApiClient.instance.createTodo(title);
      await _load();
      _showSnack('Todo added successfully!', isError: false);
    } catch (e) {
      _showSnack(e.toString());
    }
  }

  Future<void> _toggleComplete(Map<String, dynamic> todo) async {
    try {
      if (!(todo['done'] == true)) {
        await ApiClient.instance.completeTodo(todo['_id']?.toString() ?? '');
      }
      await _load();
    } catch (e) {
      _showSnack(e.toString());
    }
  }

  Future<void> _delete(Map<String, dynamic> todo) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Todo'),
        content: Text('Are you sure you want to delete "${todo['title']}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await ApiClient.instance.deleteTodo(todo['_id']?.toString() ?? '');
        await _load();
        _showSnack('Todo deleted successfully!', isError: false);
      } catch (e) {
        _showSnack(e.toString());
      }
    }
  }

  void _showSnack(String msg, {bool isError = true}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: isError ? Colors.red : Colors.green,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  List<Map<String, dynamic>> get _filteredTodos {
    switch (_filter) {
      case 'pending':
        return _todos.where((todo) => todo['done'] != true).toList();
      case 'completed':
        return _todos.where((todo) => todo['done'] == true).toList();
      default:
        return _todos;
    }
  }

  int get _pendingCount => _todos.where((todo) => todo['done'] != true).length;
  int get _completedCount => _todos.where((todo) => todo['done'] == true).length;

  @override
  Widget build(BuildContext context) {
    final filteredTodos = _filteredTodos;

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Todos'),
        backgroundColor: Colors.indigo.shade50,
        elevation: 0,
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.filter_list),
            onSelected: (value) => setState(() => _filter = value),
            itemBuilder: (context) => [
              PopupMenuItem(
                value: 'all',
                child: Row(
                  children: [
                    Icon(Icons.list, color: _filter == 'all' ? Colors.indigo : null),
                    const SizedBox(width: 8),
                    const Text('All'),
                    const Spacer(),
                    Text('${_todos.length}'),
                  ],
                ),
              ),
              PopupMenuItem(
                value: 'pending',
                child: Row(
                  children: [
                    Icon(Icons.pending_actions, color: _filter == 'pending' ? Colors.indigo : null),
                    const SizedBox(width: 8),
                    const Text('Pending'),
                    const Spacer(),
                    Text('$_pendingCount'),
                  ],
                ),
              ),
              PopupMenuItem(
                value: 'completed',
                child: Row(
                  children: [
                    Icon(Icons.check_circle, color: _filter == 'completed' ? Colors.indigo : null),
                    const SizedBox(width: 8),
                    const Text('Completed'),
                    const Spacer(),
                    Text('$_completedCount'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          // Stats card
          Container(
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [Colors.indigo.shade400, Colors.indigo.shade600],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Today\'s Progress',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '$_completedCount of ${_todos.length} completed',
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ),
                CircularProgressIndicator(
                  value: _todos.isEmpty ? 0 : _completedCount / _todos.length,
                  backgroundColor: Colors.white30,
                  valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
                  strokeWidth: 6,
                ),
                const SizedBox(width: 8),
                Text(
                  _todos.isEmpty ? '0%' : '${((_completedCount / _todos.length) * 100).round()}%',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),

          // Filter chips
          Container(
            height: 50,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                _buildFilterChip('All', 'all', _todos.length),
                const SizedBox(width: 8),
                _buildFilterChip('Pending', 'pending', _pendingCount),
                const SizedBox(width: 8),
                _buildFilterChip('Completed', 'completed', _completedCount),
              ],
            ),
          ),

          // Todo list
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null
                      ? _buildErrorState()
                      : filteredTodos.isEmpty
                          ? _buildEmptyState()
                          : ListView.builder(
                              padding: const EdgeInsets.all(16),
                              itemCount: filteredTodos.length,
                              itemBuilder: (context, index) {
                                final todo = filteredTodos[index];
                                return _buildTodoCard(todo, index);
                              },
                            ),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddTodoDialog,
        icon: const Icon(Icons.add),
        label: const Text('Add Todo'),
        backgroundColor: Colors.indigo,
        foregroundColor: Colors.white,
      ),
    );
  }

  Widget _buildFilterChip(String label, String value, int count) {
    final isSelected = _filter == value;
    return FilterChip(
      label: Text('$label ($count)'),
      selected: isSelected,
      onSelected: (selected) => setState(() => _filter = value),
      selectedColor: Colors.indigo.shade100,
      checkmarkColor: Colors.indigo,
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline, size: 64, color: Colors.red.shade300),
          const SizedBox(height: 16),
          Text(
            'Something went wrong',
            style: TextStyle(fontSize: 18, color: Colors.grey.shade600),
          ),
          const SizedBox(height: 8),
          Text(
            _error!,
            style: TextStyle(color: Colors.red.shade600),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _load,
            child: const Text('Try Again'),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            _filter == 'completed' ? Icons.celebration : Icons.checklist,
            size: 64,
            color: Colors.grey.shade300,
          ),
          const SizedBox(height: 16),
          Text(
            _filter == 'completed'
                ? 'No completed todos yet'
                : _filter == 'pending'
                    ? 'No pending todos'
                    : 'No todos yet',
            style: TextStyle(fontSize: 18, color: Colors.grey.shade600),
          ),
          const SizedBox(height: 8),
          Text(
            _filter == 'completed'
                ? 'Complete some todos to see them here'
                : 'Tap the + button to add your first todo',
            style: TextStyle(color: Colors.grey.shade500),
            textAlign: TextAlign.center,
          ),
          if (_filter != 'completed') ...[
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: _showAddTodoDialog,
              icon: const Icon(Icons.add),
              label: const Text('Add Todo'),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildTodoCard(Map<String, dynamic> todo, int index) {
    final title = (todo['title'] ?? '').toString();
    final done = todo['done'] == true;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: Card(
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => _toggleComplete(todo),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  child: Icon(
                    done ? Icons.check_circle : Icons.radio_button_unchecked,
                    color: done ? Colors.green : Colors.grey.shade400,
                    size: 28,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AnimatedDefaultTextStyle(
                        duration: const Duration(milliseconds: 200),
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                          decoration: done ? TextDecoration.lineThrough : null,
                          color: done ? Colors.grey.shade500 : Colors.black87,
                        ),
                        child: Text(title),
                      ),
                      if (todo['description'] != null && todo['description'].toString().isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          todo['description'].toString(),
                          style: TextStyle(
                            fontSize: 14,
                            color: done ? Colors.grey.shade400 : Colors.grey.shade600,
                            decoration: done ? TextDecoration.lineThrough : null,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                PopupMenuButton<String>(
                  onSelected: (value) {
                    switch (value) {
                      case 'delete':
                        _delete(todo);
                        break;
                      case 'toggle':
                        _toggleComplete(todo);
                        break;
                    }
                  },
                  itemBuilder: (context) => [
                    PopupMenuItem(
                      value: 'toggle',
                      child: Row(
                        children: [
                          Icon(done ? Icons.undo : Icons.check),
                          const SizedBox(width: 8),
                          Text(done ? 'Mark Pending' : 'Mark Complete'),
                        ],
                      ),
                    ),
                    const PopupMenuItem(
                      value: 'delete',
                      child: Row(
                        children: [
                          Icon(Icons.delete, color: Colors.red),
                          SizedBox(width: 8),
                          Text('Delete', style: TextStyle(color: Colors.red)),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

