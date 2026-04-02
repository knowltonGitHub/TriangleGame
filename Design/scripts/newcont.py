import matplotlib.pyplot as plt
import numpy as np

def draw_adaptive_jagged_t():
    # s = side, h = altitude
    s = 1.0
    h = np.sqrt(3) / 2
    
    plt.figure(figsize=(10, 8))
    ax = plt.subplot(1, 1, 1, aspect='equal')
    
    # 1. Define the abstract 'Target Area' (The T)
    # This is just a concept, not drawn lines.
    
    # 2. Build the 'T' geometry using only pure equilateral grid slots
    # Base (5 units wide, 2 units high)
    centers = []
    # Row 0 and Row 1
    for row in range(0, 2):
        for col in range(-2, 3):
            centers.append((col * s, row * h + h/3)) # Slot 'A' (Up-pointing)
            centers.append((col * s, row * h + 2*h/3)) # Slot 'B' (Down-pointing)

    # Shaft (2 units wide, 6 units high)
    for row in range(2, 8):
        for col in range(-1, 1): # Center shaft
            centers.append((col * s + 0.5, row * h + h/3)) # Staggered grid logic
            centers.append((col * s + 0.5, row * h + 2*h/3))

    # 3. Draw the 'Legal' Slots
    for i, (cx, cy) in enumerate(centers):
        # Alternate Up and Down orientation to form the tessellation
        if i % 2 == 0:
            # Point Up
            tx = [cx, cx + 0.5, cx - 0.5]
            ty = [cy + h/3, cy - 2*h/3, cy - 2*h/3]
        else:
            # Point Down
            tx = [cx, cx + 0.5, cx - 0.5]
            ty = [cy - h/3, cy + 2*h/3, cy + 2*h/3]
            
        ax.fill(tx, ty, facecolor='none', edgecolor='black', alpha=0.3, linewidth=1)

    ax.axis('off')
    plt.title("Gapless Sawtooth Container (Built from Triangles)")
    plt.show()

if __name__ == "__main__":
    draw_adaptive_jagged_t()