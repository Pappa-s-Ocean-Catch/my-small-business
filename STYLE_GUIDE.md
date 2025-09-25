# Style Guide for Future Development

This document provides comprehensive guidelines for maintaining consistent UI/UX patterns when adding new models and features to the application.

## 🎯 Core Principles

### 1. **Component Reusability**
- **ALWAYS** use shared components over custom implementations
- **NEVER** create duplicate functionality when a shared component exists
- **PREFER** extending existing components over creating new ones

### 2. **Consistent Styling**
- **ALWAYS** follow the established design system
- **NEVER** use inline styles or custom CSS classes
- **ALWAYS** use Tailwind CSS utility classes consistently

### 3. **User Experience**
- **ALWAYS** provide loading states for async operations
- **ALWAYS** show clear feedback for user actions
- **ALWAYS** handle errors gracefully with meaningful messages

## 🧩 Required Components

### Modal Components
**MANDATORY**: Use the shared `Modal` component for all popups and dialogs.

```tsx
import Modal from "@/components/Modal";

// ✅ CORRECT - Use shared Modal component
<Modal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  title="Modal Title"
  size="md" // 'sm' | 'md' | 'lg' | 'xl'
>
  <div className="px-6 py-4">
    {/* Modal content */}
  </div>
  <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-neutral-800">
    {/* Modal footer with actions */}
  </div>
</Modal>

// ❌ WRONG - Don't create custom modal implementations
<div className="fixed inset-0 bg-gray-600 bg-opacity-50">
  <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md">
    {/* Custom modal content */}
  </div>
</div>
```

### Action Buttons
**MANDATORY**: Use `ActionButton` for all async operations.

```tsx
import { ActionButton } from "@/components/ActionButton";

// ✅ CORRECT - Use ActionButton for async operations
<ActionButton
  onClick={async () => {
    await handleAsyncOperation();
  }}
  variant="primary" // 'primary' | 'secondary' | 'danger' | 'success'
  size="md" // 'sm' | 'md' | 'lg'
  icon={<IconComponent className="w-4 h-4" />}
  loadingText="Processing..." // Optional custom loading text
  title="Button tooltip" // Optional tooltip
>
  Button Text
</ActionButton>

// ❌ WRONG - Don't use regular buttons for async operations
<button
  onClick={handleAsyncOperation}
  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
>
  Button Text
</button>
```

### Confirmation Dialogs
**MANDATORY**: Use `ConfirmationDialog` for all destructive actions.

```tsx
import { ConfirmationDialog } from "@/components/ConfirmationDialog";

// ✅ CORRECT - Use ConfirmationDialog for destructive actions
<ConfirmationDialog
  isOpen={showDeleteDialog}
  onClose={() => setShowDeleteDialog(false)}
  onConfirm={handleDelete}
  title="Delete Item"
  message="Are you sure you want to delete this item? This action cannot be undone."
  variant="danger" // 'danger' | 'warning' | 'info'
/>

// ❌ WRONG - Don't use browser confirm() or custom implementations
if (confirm("Are you sure?")) {
  handleDelete();
}
```

## 🎨 Styling Patterns

### Form Styling
**MANDATORY**: Use consistent form styling patterns.

```tsx
// ✅ CORRECT - Standard form field styling
<div className="space-y-4">
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
      Field Label
    </label>
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      required
    />
  </div>
</div>
```

### Table Styling
**MANDATORY**: Use consistent table styling patterns.

```tsx
// ✅ CORRECT - Standard table styling
<div className="overflow-hidden">
  <table className="min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
    <thead className="bg-gray-50 dark:bg-neutral-700">
      <tr>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
          Column Header
        </th>
      </tr>
    </thead>
    <tbody className="bg-white dark:bg-neutral-800 divide-y divide-gray-200 dark:divide-neutral-700">
      <tr className="hover:bg-gray-50 dark:hover:bg-neutral-700">
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-900 dark:text-white">
            Cell Content
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### Card/Block Styling
**MANDATORY**: Use consistent card styling patterns.

```tsx
// ✅ CORRECT - Standard card styling
<div className="bg-white dark:bg-neutral-800 rounded-lg shadow">
  <div className="p-6">
    {/* Card content */}
  </div>
</div>

// ✅ ALTERNATIVE - Use Card component if available
<Card variant="elevated" padding="md">
  {/* Card content */}
</Card>
```

### Button Styling
**MANDATORY**: Use consistent button styling patterns.

```tsx
// ✅ CORRECT - Standard button styling
<button
  onClick={handleClick}
  className="p-2 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
  title="Button tooltip"
>
  <IconComponent className="w-4 h-4" />
</button>

// ✅ CORRECT - Cancel button styling
<button
  type="button"
  onClick={handleCancel}
  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-neutral-600 rounded-md hover:bg-gray-300 dark:hover:bg-neutral-500 transition-colors"
>
  Cancel
</button>
```

## 📋 Implementation Checklist

When adding new models or features, ensure:

### ✅ **Modal Implementation**
- [ ] Use shared `Modal` component
- [ ] Proper modal sizing (`sm`, `md`, `lg`, `xl`)
- [ ] Consistent header and footer styling
- [ ] Proper form handling within modals

### ✅ **Button Implementation**
- [ ] Use `ActionButton` for async operations
- [ ] Use appropriate variants (`primary`, `secondary`, `danger`, `success`)
- [ ] Include icons with proper sizing (`w-4 h-4`)
- [ ] Add tooltips for icon-only buttons

### ✅ **Form Implementation**
- [ ] Consistent field styling
- [ ] Proper validation and error handling
- [ ] Loading states for form submissions
- [ ] Clear success/error feedback

### ✅ **Table Implementation**
- [ ] Consistent table styling
- [ ] Proper hover states
- [ ] Action buttons with consistent styling
- [ ] Responsive design considerations

### ✅ **Confirmation Dialogs**
- [ ] Use `ConfirmationDialog` for destructive actions
- [ ] Clear, descriptive messages
- [ ] Appropriate variant selection
- [ ] Proper error handling

### ✅ **Error Handling**
- [ ] Graceful error handling
- [ ] Clear error messages
- [ ] Proper loading states
- [ ] User feedback for all actions

## 🚫 Prohibited Patterns

### ❌ **Custom Modal Implementations**
```tsx
// ❌ WRONG - Don't create custom modals
<div className="fixed inset-0 bg-gray-600 bg-opacity-50">
  <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md">
    {/* Custom modal content */}
  </div>
</div>
```

### ❌ **Regular Buttons for Async Operations**
```tsx
// ❌ WRONG - Don't use regular buttons for async operations
<button
  onClick={async () => {
    await handleAsyncOperation();
  }}
  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
>
  Async Action
</button>
```

### ❌ **Browser Confirm Dialogs**
```tsx
// ❌ WRONG - Don't use browser confirm dialogs
if (confirm("Are you sure?")) {
  handleDelete();
}
```

### ❌ **Inconsistent Styling**
```tsx
// ❌ WRONG - Don't use inconsistent styling
<div className="border-2 border-gray-300 rounded-2xl p-4">
  {/* Heavy borders and excessive rounding */}
</div>
```

## 🔧 Development Workflow

### 1. **Before Starting**
- Review existing components and patterns
- Identify reusable components
- Plan the component structure

### 2. **During Development**
- Use shared components whenever possible
- Follow established styling patterns
- Implement proper error handling
- Add loading states for async operations

### 3. **Before Completion**
- Test all functionality
- Verify consistent styling
- Check error handling
- Ensure proper user feedback

### 4. **Code Review Checklist**
- [ ] Uses shared components
- [ ] Follows styling patterns
- [ ] Implements proper error handling
- [ ] Includes loading states
- [ ] Has clear user feedback
- [ ] Follows accessibility guidelines

## 📚 Component Reference

### Available Shared Components
- `Modal` - For all popups and dialogs
- `ActionButton` - For async operations
- `ConfirmationDialog` - For destructive actions
- `Card` - For content blocks
- `Loading` - For loading states
- `Snackbar` - For notifications

### Icon Requirements
- **ALWAYS** use icons from `react-icons`
- **NEVER** use emoji icons in React components
- **ALWAYS** use consistent sizing (`w-4 h-4` for standard, `w-3 h-3` for small)
- **ALWAYS** include icons with text in buttons

### Color Scheme
- **Primary**: Blue (`blue-600`, `blue-700`)
- **Success**: Green (`green-600`, `green-700`)
- **Danger**: Red (`red-600`, `red-700`)
- **Secondary**: Gray (`gray-200`, `gray-300`)
- **Background**: White/Dark (`white`, `neutral-800`)

## 🎯 Best Practices

1. **Consistency First**: Always prefer consistency over customization
2. **User Experience**: Prioritize clear feedback and loading states
3. **Accessibility**: Ensure proper ARIA labels and keyboard navigation
4. **Performance**: Use proper loading states and error boundaries
5. **Maintainability**: Follow established patterns for easier maintenance

## 📝 Notes

- This style guide should be updated when new patterns are established
- All team members should follow these guidelines consistently
- When in doubt, refer to existing implementations in the codebase
- Always test new components thoroughly before deployment
