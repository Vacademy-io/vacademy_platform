import torch
print(f"CUDA Available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"Device count: {torch.cuda.device_count()}")
    print(f"Current device: {torch.cuda.current_device()}")
    print(f"Device name: {torch.cuda.get_device_name(0)}")
    
    # Try to allocate a large tensor to test if expand_segments helps
    import os
    os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'expandable_segments:True'
    
    try:
        t = torch.randn(1000, 1000, device='cuda')
        print("Tensor allocation successful")
    except Exception as e:
        print(f"Tensor allocation failed: {e}")
