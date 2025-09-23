import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'screens/login_screen.dart';
import 'screens/chat_screen.dart';
import 'screens/events_screen.dart';
import 'screens/todos_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/timetable_screen.dart';
import 'screens/settings_screen.dart';

import 'services/api_client.dart';

class ChatbotApp extends StatefulWidget {
  const ChatbotApp({super.key});

  @override
  State<ChatbotApp> createState() => _ChatbotAppState();
}

class _ChatbotAppState extends State<ChatbotApp> {
  String? _token;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final prefs = await SharedPreferences.getInstance();
    // Load saved API base URL override if any
    final savedBase = prefs.getString('api_base_url');
    if (savedBase != null && savedBase.trim().isNotEmpty) {
      ApiClient.instance.baseUrl = savedBase.trim();
    }
    final token = prefs.getString('jwt');
    setState(() {
      _token = token;
      _loading = false;
    });
  }

  void _onLoggedIn(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('jwt', token);
    setState(() => _token = token);
  }

  void _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('jwt');
    setState(() => _token = null);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const MaterialApp(home: Scaffold(body: Center(child: CircularProgressIndicator())));
    }
    return MaterialApp(
      title: 'Vignan Chatbot',
      theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
      home: _token == null
          ? LoginScreen(onLoggedIn: _onLoggedIn)
          : _HomeShell(onLogout: _logout),
    );
  }
}


class _HomeShell extends StatefulWidget {
  final VoidCallback onLogout;
  const _HomeShell({required this.onLogout});
  @override
  State<_HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<_HomeShell> {
  int _index = 0;
  final ValueNotifier<String?> _prefill = ValueNotifier<String?>(null);

  void _askAboutEvent(String text) {
    setState(() => _index = 0);
    _prefill.value = text;
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      ChatScreen(onLogout: widget.onLogout, prefillNotifier: _prefill),
      EventsScreen(onAskAboutEvent: _askAboutEvent),
      const TodosScreen(),
      const TimetableScreen(),
      const ProfileScreen(),
      const SettingsScreen(),
    ];
    return Scaffold(
      body: IndexedStack(index: _index, children: screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.chat_bubble_outline), selectedIcon: Icon(Icons.chat_bubble), label: 'Chat'),
          NavigationDestination(icon: Icon(Icons.event_outlined), selectedIcon: Icon(Icons.event), label: 'Events'),
          NavigationDestination(icon: Icon(Icons.checklist_outlined), selectedIcon: Icon(Icons.checklist), label: 'Todos'),
          NavigationDestination(icon: Icon(Icons.schedule_outlined), selectedIcon: Icon(Icons.schedule), label: 'Timetable'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
          NavigationDestination(icon: Icon(Icons.settings_outlined), selectedIcon: Icon(Icons.settings), label: 'Settings'),
        ],
      ),
    );
  }
}
