import 'package:flutter/material.dart';
import '../services/api_client.dart';

class EventsScreen extends StatefulWidget {
  final void Function(String prefill)? onAskAboutEvent;
  const EventsScreen({super.key, this.onAskAboutEvent});

  @override
  State<EventsScreen> createState() => _EventsScreenState();
}

class _EventsScreenState extends State<EventsScreen> {
  List<Map<String, dynamic>> _events = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final items = await ApiClient.instance.getEvents();
      setState(() { _events = items; });
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      if (mounted) setState(() { _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Events')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? ListView(children:[Padding(padding: const EdgeInsets.all(16), child: Text(_error!, style: const TextStyle(color: Colors.red)) )])
                : _events.isEmpty
                    ? ListView(children:[const Padding(padding: EdgeInsets.all(16), child: Text('No events yet.'))])
                    : ListView.builder(
                        itemCount: _events.length,
                        itemBuilder: (_, i) {
                          final ev = _events[i];
                          final title = (ev['title'] ?? '').toString();
                          final img = ((ev['imageUrl'] ?? '').toString().trim().isNotEmpty)
                              ? ev['imageUrl']
                              : ((ev['imagePath'] ?? '').toString().trim().isNotEmpty)
                                  ? ev['imagePath']
                                  : null;
                          return Card(
                            margin: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                            clipBehavior: Clip.antiAlias,
                            child: InkWell(
                              onTap: widget.onAskAboutEvent == null ? null : () => widget.onAskAboutEvent!("Tell me about the event: $title."),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (img != null)
                                    AspectRatio(
                                      aspectRatio: 16/9,
                                      child: Image.network(img, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const SizedBox()),
                                    ),
                                  Padding(
                                    padding: const EdgeInsets.all(12),
                                    child: Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}

