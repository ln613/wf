/* eslint-disable */
import { onMount } from 'solid-js'
import { todoStore, todoStoreActions } from '../stores/todoStore'
import './TodoList.css'

export const TodoList = () => {
  onMount(() => {
    todoStoreActions.fetchTodos()
  })

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault()
    todoStoreActions.addTodo()
  }

  return (
    <div class="todo-list">
      <h1>Todo List</h1>

      {todoStore.error && <div class="error">{todoStore.error}</div>}

      <form onSubmit={handleSubmit} class="add-form">
        <input
          type="text"
          value={todoStore.newTitle}
          onInput={(e) => todoStoreActions.setNewTitle((e.target as HTMLInputElement).value)}
          placeholder="Add a new todo..."
        />
        <button type="submit">Add</button>
      </form>

      <ul>
        {todoStore.todos.map((todo) => (
          <li class={todo.completed ? 'completed' : ''}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => todoStoreActions.toggleTodo(todo)}
            />
            <span>{todo.title}</span>
            <button onClick={() => todoStoreActions.deleteTodo(todo._id!)}>Delete</button>
          </li>
        ))}
      </ul>

      {todoStore.todos.length === 0 && !todoStore.loading && <p class="empty">No todos yet!</p>}
      {todoStore.loading && <div class="loading">Loading...</div>}
    </div>
  )
}