import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../widgets/api_base_url_dialog.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _loading = true;
  String? _error;
  String _defaultLanguage = 'en';
  String _responseStyle = 'friendly';
  String _answerLength = 'medium';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final prefs = await ApiClient.instance.getPreferences();
      setState(() {
        _defaultLanguage = (prefs['defaultLanguage'] ?? 'en').toString();
        _responseStyle = (prefs['responseStyle'] ?? 'friendly').toString();
        _answerLength = (prefs['answerLength'] ?? 'medium').toString();
      });
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      if (mounted) setState(() { _loading = false; });
    }
  }

  Future<void> _save() async {
    setState(() { _loading = true; _error = null; });
    try {
      await ApiClient.instance.updatePreferences({
        'defaultLanguage': _defaultLanguage,
        'responseStyle': _responseStyle,
        'answerLength': _answerLength,
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Preferences saved')));
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      if (mounted) setState(() { _loading = false; });
    }
  }

  Future<void> _openServerSettings() async {
    await showDialog(context: context, builder: (_) => const ApiBaseUrlDialog());
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('API set to: ${ApiClient.instance.baseUrl}')));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(_error!, style: const TextStyle(color: Colors.red)),
                  ),
                const Text('Language', style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: _defaultLanguage,
                  items: const [
                    DropdownMenuItem(value: 'en', child: Text('English')),
                    DropdownMenuItem(value: 'hi', child: Text('Hindi')),
                    DropdownMenuItem(value: 'te', child: Text('Telugu')),
                    DropdownMenuItem(value: 'gu', child: Text('Gujarati')),
                    DropdownMenuItem(value: 'ta', child: Text('Tamil')),
                    DropdownMenuItem(value: 'kn', child: Text('Kannada')),
                  ],
                  onChanged: (v) => setState(() => _defaultLanguage = v ?? 'en'),
                ),
                const SizedBox(height: 16),
                const Text('Response style', style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: _responseStyle,
                  items: const [
                    DropdownMenuItem(value: 'friendly', child: Text('Friendly')),
                    DropdownMenuItem(value: 'formal', child: Text('Formal')),
                  ],
                  onChanged: (v) => setState(() => _responseStyle = v ?? 'friendly'),
                ),
                const SizedBox(height: 16),
                const Text('Answer length', style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: _answerLength,
                  items: const [
                    DropdownMenuItem(value: 'short', child: Text('Short')),
                    DropdownMenuItem(value: 'medium', child: Text('Medium')),
                    DropdownMenuItem(value: 'long', child: Text('Long')),
                  ],
                  onChanged: (v) => setState(() => _answerLength = v ?? 'medium'),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  height: 48,
                  child: FilledButton(
                    onPressed: _save,
                    child: const Text('Save Preferences'),
                  ),
                ),
                const SizedBox(height: 24),
                const Divider(),
                const SizedBox(height: 12),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Server API'),
                  subtitle: Text(ApiClient.instance.baseUrl),
                  trailing: FilledButton.tonal(onPressed: _openServerSettings, child: const Text('Change')),
                ),
              ],
            ),
    );
  }
}

