import { useState, useEffect } from 'react'
import { apiGet, apiPost } from '../utils/api'
import type { Todo } from '../types/todo'

export const TodoList = () => {
  const [todos, setTodos] = useState<Todo[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchTodos()
  }, [])

  const fetchTodos = async () => {
    try {
      setLoading(true)
      const data = await apiGet('todos')
      setTodos(data)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch todos')
    } finally {
      setLoading(false)
    }
  }

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    try {
      const todo = await apiPost('todo', { title: newTitle.trim() })
      setTodos([todo, ...todos])
      setNewTitle('')
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add todo')
    }
  }

  const toggleTodo = async (todo: Todo) => {
    try {
      const updated = await apiPost('todo', {
        ...todo,
        completed: !todo.completed,
      })
      setTodos(todos.map((t) => (t._id === updated._id ? updated : t)))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update todo')
    }
  }

  const deleteTodo = async (id: string) => {
    try {
      await apiPost('deleteTodo', { id })
      setTodos(todos.filter((t) => t._id !== id))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete todo')
    }
  }

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="todo-list">
      <h1>Todo List</h1>

      {error && <div className="error">{error}</div>}

      <form onSubmit={addTodo} className="add-form">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a new todo..."
        />
        <button type="submit">Add</button>
      </form>

      <ul>
        {todos.map((todo) => (
          <li key={todo._id} className={todo.completed ? 'completed' : ''}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo)}
            />
            <span>{todo.title}</span>
            <button onClick={() => deleteTodo(todo._id!)}>Delete</button>
          </li>
        ))}
      </ul>

      {todos.length === 0 && <p className="empty">No todos yet!</p>}
    </div>
  )
}