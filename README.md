# chat-tree
Experimental UI for chatting with LLMs. Provides ability to control context by representing the conversation as a graph of nodes, allowing for branching and merging.


TODO
- pin user message to top on send
- scroll to message on node selection (with directionality)
- stop generation - replace send button in @MessageInput.tsx with a circular priamry button and up arrow (white but use semantic coloring). when a message is sending, instead of disabling the send button, lets change it to a stop button (with a square). when pressed, the generation is stopped (but not as an erorr, just like incomplete).

- recenter tree on resize
- fix node hover preview
- merge branches