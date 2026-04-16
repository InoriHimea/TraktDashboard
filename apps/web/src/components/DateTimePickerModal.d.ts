interface DateTimePickerModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (isoString: string) => void;
    defaultValue?: Date;
}
export declare function DateTimePickerModal({ open, onClose, onConfirm, defaultValue }: DateTimePickerModalProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=DateTimePickerModal.d.ts.map