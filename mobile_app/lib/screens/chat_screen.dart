import 'package:flutter/material.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_client.dart';
import '../widgets/message_bubble.dart';
import '../widgets/api_base_url_dialog.dart';

class ChatScreen extends StatefulWidget {
  final VoidCallback onLogout;
  final ValueNotifier<String?>? prefillNotifier;
  const ChatScreen({super.key, required this.onLogout, this.prefillNotifier});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _controller = TextEditingController();
  final _scrollCtrl = ScrollController();
  final FocusNode _inputFocus = FocusNode();
  final List<Map<String, String>> _messages = [];
  bool _sending = false;
  String? _error;

  // Language / TTS
  String _language = 'en';
  final FlutterTts _tts = FlutterTts();
  bool _speaking = false;

  @override
  void initState() {
    super.initState();
    _loadInitial();
    widget.prefillNotifier?.addListener(_handlePrefill);
  }

  Future<void> _loadInitial() async {
    // Load history to show continuity
    try {
      final history = await ApiClient.instance.getSessionHistory();
      if (history.isNotEmpty) {
        setState(() {
          for (final h in history) {
            _messages.add({'role': (h['role'] ?? 'assistant'), 'text': (h['content'] ?? '').toString()});
          }
        });
      }
    } catch (_) {}
    _scrollToEndSoon();
  }

  @override
  void dispose() {
    widget.prefillNotifier?.removeListener(_handlePrefill);
    _controller.dispose();
    _scrollCtrl.dispose();
    _inputFocus.dispose();
    super.dispose();
  }

  void _handlePrefill() {
    final msg = widget.prefillNotifier?.value;
    if (msg == null || msg.isEmpty) return;
    _controller.text = msg;
    _inputFocus.requestFocus();
    // Do not auto-send; user can edit then send
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() { _sending = true; _error = null; _messages.add({'role':'user','text':text}); });
    _controller.clear();
    _scrollToEndSoon();
    try {
      final ans = await ApiClient.instance.sendChat(text, language: _language);
      setState(() { _messages.add({'role':'assistant','text': ans}); });
      _speak(ans);
    } catch (e) {
      setState(() { _error = e.toString(); });
      if (e.toString().contains('401') || e.toString().contains('Not authenticated')) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.remove('jwt');
        if (mounted) widget.onLogout();
      }
    } finally {
      if (mounted) setState(() { _sending = false; });
      _scrollToEndSoon();
    }
  }

  void _scrollToEndSoon() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent + 100,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _confirmLogout() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Logout'),
        content: const Text('Do you really want to logout?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Logout')),
        ],
      ),
    );
    if (ok == true) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('jwt');
      widget.onLogout();
    }
  }

  Future<void> _openServerSettings() async {
    await showDialog(context: context, builder: (_) => const ApiBaseUrlDialog());
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('API set to: ${ApiClient.instance.baseUrl}')),
      );
    }
  }


  Future<void> _speak(String text) async {
    if (_speaking) {
      await _tts.stop();
      setState(() => _speaking = false);
      return;
    }
    await _tts.setLanguage(_langToLocale(_language));
    await _tts.setSpeechRate(0.5);
    setState(() => _speaking = true);
    await _tts.speak(text);
    setState(() => _speaking = false);
  }

  String _langToLocale(String lang) {
    switch (lang) {
      case 'hi': return 'hi-IN';
      case 'te': return 'te-IN';
      case 'gu': return 'gu-IN';
      case 'ta': return 'ta-IN';
      case 'kn': return 'kn-IN';
      default: return 'en-US';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chatbot'),
        actions: [
          DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _language,
              onChanged: (v) => setState(() => _language = v ?? 'en'),
              items: const [
                DropdownMenuItem(value: 'en', child: Text('EN')),
                DropdownMenuItem(value: 'hi', child: Text('HI')),
                DropdownMenuItem(value: 'te', child: Text('TE')),
                DropdownMenuItem(value: 'gu', child: Text('GU')),
                DropdownMenuItem(value: 'ta', child: Text('TA')),
                DropdownMenuItem(value: 'kn', child: Text('KN')),
              ],
            ),
          ),
          IconButton(onPressed: _openServerSettings, icon: const Icon(Icons.settings)),
          IconButton(onPressed: _sending ? null : _confirmLogout, icon: const Icon(Icons.logout)),
        ],
      ),
      body: Column(
        children: [
          if (_error != null)
            MaterialBanner(
              content: Text(_error!, style: const TextStyle(color: Colors.white)),
              backgroundColor: Colors.red.shade400,
              actions: [TextButton(onPressed: () => setState(() => _error = null), child: const Text('DISMISS', style: TextStyle(color: Colors.white)) )],
            ),
          Expanded(
            child: ListView.builder(
              controller: _scrollCtrl,
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 12),
              itemCount: _messages.length,
              itemBuilder: (_, i) {
                final m = _messages[i];
                final isUser = m['role'] == 'user';
                return MessageBubble(text: m['text'] ?? '', isUser: isUser);
              },
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      focusNode: _inputFocus,
                      minLines: 1,
                      maxLines: 4,
                      decoration: const InputDecoration(
                        hintText: 'Type your message...',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                      onSubmitted: (_) => _send(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    onPressed: _messages.isNotEmpty && _messages.last['role'] == 'assistant' && (_messages.last['text'] ?? '').isNotEmpty
                        ? () => _speak(_messages.last['text']!)
                        : null,
                    icon: Icon(_speaking ? Icons.stop_circle_outlined : Icons.volume_up),
                    tooltip: _speaking ? 'Stop' : 'Speak last reply',
                  ),
                  const SizedBox(width: 4),
                  SizedBox(
                    height: 44,
                    child: FilledButton.icon(
                      onPressed: _sending ? null : _send,
                      icon: _sending
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.send, size: 18),
                      label: const Text('Send'),
                    ),
                  )
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

