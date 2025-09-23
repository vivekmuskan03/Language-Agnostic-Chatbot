import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';

class MessageBubble extends StatelessWidget {
  final String text;
  final bool isUser;
  const MessageBubble({super.key, required this.text, required this.isUser});

  @override
  Widget build(BuildContext context) {
    final bg = isUser ? Colors.indigo.shade600 : Colors.grey.shade200;
    final fg = isUser ? Colors.white : Colors.black87;
    final align = isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start;
    final radius = BorderRadius.only(
      topLeft: const Radius.circular(16),
      topRight: const Radius.circular(16),
      bottomLeft: isUser ? const Radius.circular(16) : const Radius.circular(4),
      bottomRight: isUser ? const Radius.circular(4) : const Radius.circular(16),
    );

    Widget content;
    if (isUser) {
      content = SelectableText(text, style: TextStyle(color: fg));
    } else {
      content = MarkdownBody(
        data: text.trim().isEmpty ? 'No content' : text,
        selectable: true,
        styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context)).copyWith(
          p: TextStyle(color: fg),
        ),
      );
    }

    return Column(
      crossAxisAlignment: align,
      children: [
        Container(
          margin: const EdgeInsets.symmetric(vertical: 6),
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
          decoration: BoxDecoration(color: bg, borderRadius: radius),
          child: content,
        ),
      ],
    );
  }
}
