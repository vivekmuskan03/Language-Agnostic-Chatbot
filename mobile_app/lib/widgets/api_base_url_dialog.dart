import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_client.dart';

class ApiBaseUrlDialog extends StatefulWidget {
  const ApiBaseUrlDialog({super.key});

  @override
  State<ApiBaseUrlDialog> createState() => _ApiBaseUrlDialogState();
}

class _ApiBaseUrlDialogState extends State<ApiBaseUrlDialog> {
  late final TextEditingController _urlCtrl;
  String? _error;

  @override
  void initState() {
    super.initState();
    _urlCtrl = TextEditingController(text: ApiClient.instance.baseUrl);
  }

  @override
  void dispose() {
    _urlCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final v = _urlCtrl.text.trim();
    if (!v.startsWith('http://') && !v.startsWith('https://')) {
      setState(() => _error = 'Please enter a valid http(s) URL');
      return;
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('api_base_url', v);
    ApiClient.instance.baseUrl = v;
    if (mounted) Navigator.pop(context, v);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('API Server URL'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _urlCtrl,
            decoration: InputDecoration(
              labelText: 'Base URL (e.g., http://10.20.24.228:5000/api)',
              errorText: _error,
            ),
          ),
          const SizedBox(height: 8),
          const Text('Your phone and PC must be on the same Wi‑Fi/hotspot.')
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(onPressed: _save, child: const Text('Save')),
      ],
    );
  }
}

