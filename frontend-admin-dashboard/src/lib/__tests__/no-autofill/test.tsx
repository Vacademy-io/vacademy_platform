import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MyInput } from '@/components/design-system/input';
import { AutofillDecoy } from '@/components/design-system/autofill-decoy';

// MyInput renders its <Label> unassociated with the input, so query by element.
const inputOf = (container: HTMLElement) => container.querySelector('input') as HTMLInputElement;

describe('MyInput autofill defaults', () => {
    it('suppresses autofill on password fields', () => {
        const { container } = render(
            <MyInput inputType="password" input="secret" onChangeFunction={() => {}} />
        );
        const el = inputOf(container);
        // Chrome ignores `off` on credential fields; `new-password` is the token
        // that actually stops the saved-credential dropdown.
        expect(el.getAttribute('autocomplete')).toBe('new-password');
        expect(el.getAttribute('data-lpignore')).toBe('true');
        expect(el.getAttribute('data-1p-ignore')).toBe('true');
    });

    it('suppresses autofill on plain text fields', () => {
        const { container } = render(
            <MyInput inputType="text" input="" onChangeFunction={() => {}} />
        );
        expect(inputOf(container).getAttribute('autocomplete')).toBe('off');
    });

    it('lets the login form opt back in, without the manager opt-outs', () => {
        const { container } = render(
            <MyInput
                inputType="password"
                input=""
                onChangeFunction={() => {}}
                autoComplete="current-password"
            />
        );
        const el = inputOf(container);
        expect(el.getAttribute('autocomplete')).toBe('current-password');
        expect(el.getAttribute('data-lpignore')).toBeNull();
    });

    it('still fills normally: value renders and typing propagates', () => {
        const onChange = vi.fn();
        const { container } = render(
            <MyInput inputType="text" input="Ada" onChangeFunction={onChange} />
        );
        const el = inputOf(container);
        expect(el.value).toBe('Ada');
        fireEvent.change(el, { target: { value: 'Ada L' } });
        expect(onChange).toHaveBeenCalled();
    });

    it('keeps other passed-through props intact', () => {
        const { container } = render(
            <MyInput
                inputType="text"
                input=""
                onChangeFunction={() => {}}
                name="learner_username_0"
                disabled
            />
        );
        const el = inputOf(container);
        expect(el.name).toBe('learner_username_0');
        expect(el.disabled).toBe(true);
    });
});

describe('AutofillDecoy', () => {
    it('renders an inert username/password pair the browser can fill instead', () => {
        const { container } = render(<AutofillDecoy />);
        const inputs = container.querySelectorAll('input');
        expect(inputs.length).toBe(2);
        inputs.forEach((i) => expect(i.getAttribute('tabindex')).toBe('-1'));
        expect(container.querySelector('[aria-hidden]')).not.toBeNull();
    });
});
